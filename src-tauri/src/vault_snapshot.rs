use crate::{
    vault_access::{authorize_vault, is_link},
    vault_error::{VaultError, VaultResult},
};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, Instant, UNIX_EPOCH},
};

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanLimits {
    maximum_entries: usize,
    maximum_duration_milliseconds: u64,
    batch_size: usize,
    maximum_content_bytes: u64,
}

impl Default for ScanLimits {
    fn default() -> Self {
        Self {
            maximum_entries: 20_000,
            maximum_duration_milliseconds: 10_000,
            batch_size: 64,
            maximum_content_bytes: 64 * 1024 * 1024,
        }
    }
}

impl ScanLimits {
    fn bounded(self) -> Self {
        Self {
            maximum_entries: self.maximum_entries.clamp(1, 20_000),
            maximum_duration_milliseconds: self.maximum_duration_milliseconds.clamp(1, 10_000),
            batch_size: self.batch_size.clamp(1, 64),
            maximum_content_bytes: self.maximum_content_bytes.clamp(1, 64 * 1024 * 1024),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotNote {
    relative_path: String,
    content: String,
    modified_at: u128,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSnapshot {
    folders: Vec<String>,
    notes: Vec<SnapshotNote>,
    entry_count: usize,
}

struct PendingNote {
    path: PathBuf,
    relative_path: String,
    modified_at: u128,
    length: u64,
}

fn check_deadline(deadline: Instant) -> VaultResult<()> {
    if Instant::now() >= deadline {
        return Err(VaultError::scan_limit());
    }
    Ok(())
}

fn scan(
    root: &Path,
    limits: ScanLimits,
    deadline: Instant,
) -> VaultResult<(VaultSnapshot, Vec<PendingNote>)> {
    let mut snapshot = VaultSnapshot::default();
    let mut pending = Vec::new();
    let mut directories = vec![(root.to_path_buf(), String::new())];
    while let Some((directory, relative)) = directories.pop() {
        check_deadline(deadline)?;
        for entry in fs::read_dir(directory)? {
            check_deadline(deadline)?;
            snapshot.entry_count += 1;
            if snapshot.entry_count > limits.maximum_entries {
                return Err(VaultError::scan_limit());
            }
            if snapshot.entry_count.is_multiple_of(limits.batch_size) {
                std::thread::yield_now();
            }
            let entry = entry?;
            let name = entry.file_name().into_string().map_err(|_| {
                VaultError::new(
                    "invalid-path",
                    "A filename in this vault is not valid Unicode.",
                )
            })?;
            if name.starts_with('.') {
                continue;
            }
            let metadata = entry.metadata()?;
            if is_link(&metadata) {
                continue;
            }
            let path = if relative.is_empty() {
                name.clone()
            } else {
                format!("{relative}/{name}")
            };
            if metadata.is_dir() {
                snapshot.folders.push(path.clone());
                directories.push((entry.path(), path));
            } else if metadata.is_file() && name.to_ascii_lowercase().ends_with(".md") {
                pending.push(PendingNote {
                    path: entry.path(),
                    relative_path: path,
                    length: metadata.len(),
                    modified_at: metadata
                        .modified()?
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis(),
                });
            }
        }
    }
    check_deadline(deadline)?;
    Ok((snapshot, pending))
}

fn read_note(
    note: &PendingNote,
    limits: ScanLimits,
    deadline: Instant,
    total_bytes: &AtomicU64,
) -> VaultResult<SnapshotNote> {
    if note.length > 8 * 1024 * 1024 {
        return Err(VaultError::scan_limit());
    }
    check_deadline(deadline)?;
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x00200000;
        options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
    }
    let mut file = options.open(&note.path)?;
    if is_link(&file.metadata()?) {
        return Err(VaultError::new(
            "invalid-path",
            "A note changed into a symbolic link or junction during scanning.",
        ));
    }
    let mut content = Vec::new();
    let mut buffer = [0; 64 * 1024];
    loop {
        check_deadline(deadline)?;
        let length = file.read(&mut buffer)?;
        if length == 0 {
            break;
        }
        if total_bytes.fetch_add(length as u64, Ordering::Relaxed) + length as u64
            > limits.maximum_content_bytes
            || content.len() + length > 8 * 1024 * 1024
        {
            return Err(VaultError::scan_limit());
        }
        content.extend_from_slice(&buffer[..length]);
    }
    Ok(SnapshotNote {
        relative_path: note.relative_path.clone(),
        modified_at: note.modified_at,
        content: String::from_utf8(content).map_err(|_| {
            VaultError::new(
                "invalid-type",
                "A Markdown file in this vault could not be read as UTF-8 text.",
            )
        })?,
    })
}

fn read_snapshot(
    root: &Path,
    include_content: bool,
    limits: ScanLimits,
) -> VaultResult<VaultSnapshot> {
    let limits = limits.bounded();
    let deadline = Instant::now() + Duration::from_millis(limits.maximum_duration_milliseconds);
    let (mut snapshot, pending) = scan(root, limits, deadline)?;
    if !include_content {
        snapshot.notes = pending
            .into_iter()
            .map(|note| SnapshotNote {
                relative_path: note.relative_path,
                modified_at: note.modified_at,
                content: String::new(),
            })
            .collect();
        return Ok(snapshot);
    }
    if pending.iter().map(|note| note.length).sum::<u64>() > limits.maximum_content_bytes {
        return Err(VaultError::scan_limit());
    }
    let total_bytes = AtomicU64::new(0);
    let chunk_size = pending.len().div_ceil(32).max(1);
    snapshot.notes = std::thread::scope(|scope| {
        let tasks: Vec<_> = pending
            .chunks(chunk_size)
            .map(|chunk| {
                let total_bytes = &total_bytes;
                scope.spawn(move || {
                    chunk
                        .iter()
                        .map(|note| read_note(note, limits, deadline, total_bytes))
                        .collect::<VaultResult<Vec<_>>>()
                })
            })
            .collect();
        let mut notes = Vec::with_capacity(pending.len());
        for task in tasks {
            notes.extend(task.join().map_err(|_| {
                VaultError::new("unavailable", "The notes folder scan was interrupted.")
            })??);
        }
        Ok::<_, VaultError>(notes)
    })?;
    check_deadline(deadline)?;
    Ok(snapshot)
}

#[tauri::command]
pub async fn read_vault_snapshot(
    app: tauri::AppHandle,
    vault_path: String,
    include_content: bool,
    limits: ScanLimits,
) -> VaultResult<VaultSnapshot> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = PathBuf::from(vault_path);
        authorize_vault(&app, &root, false)?;
        let started = Instant::now();
        let snapshot = read_snapshot(&root, include_content, limits)?;
        log::info!(
            "event=vault-snapshot elapsed_ms={} notes={}",
            started.elapsed().as_millis(),
            snapshot.notes.len()
        );
        Ok(snapshot)
    })
    .await
    .map_err(|_| VaultError::new("unavailable", "The notes folder scan was interrupted."))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_ignores_hidden_data_and_non_markdown_files() {
        let root = std::env::temp_dir().join(format!("anehalo-snapshot-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("Work")).unwrap();
        fs::create_dir_all(root.join(".trash")).unwrap();
        fs::write(root.join("Work/සිංහල 🌼.MD"), "A thought").unwrap();
        fs::write(root.join(".trash/Deleted.md"), "Private trash").unwrap();
        fs::write(root.join("image.png"), "Not a note").unwrap();
        let snapshot = read_snapshot(&root, true, ScanLimits::default()).unwrap();
        assert_eq!(snapshot.folders, vec!["Work"]);
        assert_eq!(snapshot.notes.len(), 1);
        assert_eq!(snapshot.notes[0].content, "A thought");
        assert!(
            read_snapshot(&root, false, ScanLimits::default())
                .unwrap()
                .notes[0]
                .content
                .is_empty()
        );
        let error = read_snapshot(
            &root,
            false,
            ScanLimits {
                maximum_entries: 1,
                ..ScanLimits::default()
            },
        )
        .err()
        .unwrap();
        assert_eq!(error.code, "scan-limit");
        assert_eq!(
            check_deadline(Instant::now()).unwrap_err().code,
            "scan-limit"
        );
        fs::remove_dir_all(&root).unwrap();
    }
}
