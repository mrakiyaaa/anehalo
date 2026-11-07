use serde::Serialize;
use std::{fs, path::Path, time::UNIX_EPOCH};
use tauri_plugin_fs::FsExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotNote {
    relative_path: String,
    content: String,
    modified_at: u128,
}

#[derive(Default, Serialize)]
pub struct VaultSnapshot {
    folders: Vec<String>,
    notes: Vec<SnapshotNote>,
}

struct PendingNote {
    path: std::path::PathBuf,
    relative_path: String,
    modified_at: u128,
}

fn is_link(metadata: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    metadata.file_type().is_symlink()
}

fn scan(
    directory: &Path,
    relative: &str,
    folders: &mut Vec<String>,
    pending: &mut Vec<PendingNote>,
) -> Result<(), String> {
    for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry
            .file_name()
            .into_string()
            .map_err(|_| "A filename is not valid Unicode.")?;
        if name.starts_with('.') {
            continue;
        }
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        if is_link(&metadata) {
            continue;
        }
        let path = if relative.is_empty() {
            name.clone()
        } else {
            format!("{relative}/{name}")
        };
        if metadata.is_dir() {
            folders.push(path.clone());
            scan(&entry.path(), &path, folders, pending)?;
        } else if metadata.is_file() && name.to_ascii_lowercase().ends_with(".md") {
            pending.push(PendingNote {
                path: entry.path(),
                relative_path: path,
                modified_at: metadata
                    .modified()
                    .map_err(|error| error.to_string())?
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis(),
            });
        }
    }
    Ok(())
}

fn read_snapshot(root: &Path, include_content: bool) -> Result<VaultSnapshot, String> {
    let mut snapshot = VaultSnapshot::default();
    let mut pending = Vec::new();
    scan(root, "", &mut snapshot.folders, &mut pending)?;
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
    let chunk_size = pending.len().div_ceil(32).max(1);
    snapshot.notes = std::thread::scope(|scope| {
        let tasks: Vec<_> = pending
            .chunks(chunk_size)
            .map(|chunk| {
                scope.spawn(move || {
                    chunk
                        .iter()
                        .map(|note| {
                            Ok(SnapshotNote {
                                relative_path: note.relative_path.clone(),
                                modified_at: note.modified_at,
                                content: fs::read_to_string(&note.path)
                                    .map_err(|error| error.to_string())?,
                            })
                        })
                        .collect::<Result<Vec<_>, String>>()
                })
            })
            .collect();
        let mut notes = Vec::with_capacity(pending.len());
        for task in tasks {
            notes.extend(
                task.join()
                    .map_err(|_| "The notes folder scan was interrupted.")??,
            );
        }
        Ok::<_, String>(notes)
    })?;
    Ok(snapshot)
}

#[tauri::command]
pub async fn read_vault_snapshot(
    app: tauri::AppHandle,
    vault_path: String,
    include_content: bool,
) -> Result<VaultSnapshot, String> {
    let root = std::path::PathBuf::from(vault_path);
    if !root.is_absolute()
        || root
            .components()
            .any(|component| matches!(component, std::path::Component::ParentDir))
        || !app.fs_scope().is_allowed(&root)
    {
        return Err("Choose this notes folder in Anehalo before reading it.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let started = std::time::Instant::now();
        let metadata = fs::symlink_metadata(&root).map_err(|error| error.to_string())?;
        if !metadata.is_dir() || is_link(&metadata) {
            return Err("The notes folder must be a real directory.".into());
        }
        let snapshot = read_snapshot(&root, include_content)?;
        log::info!(
            "event=vault-snapshot elapsed_ms={} notes={}",
            started.elapsed().as_millis(),
            snapshot.notes.len()
        );
        Ok(snapshot)
    })
    .await
    .map_err(|error| error.to_string())?
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
        let snapshot = read_snapshot(&root, true).unwrap();
        assert_eq!(snapshot.folders, vec!["Work"]);
        assert_eq!(snapshot.notes.len(), 1);
        assert_eq!(snapshot.notes[0].relative_path, "Work/සිංහල 🌼.MD");
        assert_eq!(snapshot.notes[0].content, "A thought");
        assert!(
            read_snapshot(&root, false).unwrap().notes[0]
                .content
                .is_empty()
        );
        fs::remove_dir_all(&root).unwrap();
    }
}
