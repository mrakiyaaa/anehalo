use crate::vault_error::{VaultError, VaultResult};
use std::{
    collections::HashSet,
    fs,
    io::Write,
    path::{Component, Path, PathBuf},
    sync::Mutex,
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;

#[derive(Default)]
pub struct VaultAccess {
    selected: Mutex<HashSet<PathBuf>>,
}

pub fn is_link(metadata: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    metadata.file_type().is_symlink()
}

fn validate_path(path: &Path) -> VaultResult<()> {
    if !path.is_absolute()
        || path
            .components()
            .any(|part| matches!(part, Component::ParentDir | Component::CurDir))
    {
        return Err(VaultError::new(
            "invalid-path",
            "Choose a valid absolute folder location.",
        ));
    }
    if !path
        .file_name()
        .is_some_and(|name| name.to_string_lossy().eq_ignore_ascii_case("Anehalo"))
    {
        return Err(VaultError::new(
            "legacy-vault",
            "This saved location is not an Anehalo vault. Choose a folder again. Your existing files have not been moved or changed.",
        ));
    }
    if path.to_string_lossy().encode_utf16().count() > 240 {
        return Err(VaultError::new(
            "path-too-long",
            "The folder path is too long. Choose a location closer to the drive root.",
        ));
    }
    for part in path.components() {
        let name = part.as_os_str().to_string_lossy().to_ascii_lowercase();
        if matches!(
            name.as_str(),
            "windows" | "program files" | "program files (x86)" | "programdata" | "appdata"
        ) {
            return Err(VaultError::new(
                "invalid-path",
                "Choose a personal folder outside Windows, Program Files, ProgramData, and AppData.",
            ));
        }
    }
    Ok(())
}

fn require_real_directory(path: &Path) -> VaultResult<()> {
    let mut current = PathBuf::new();
    for component in path.components() {
        current.push(component);
        if !current.is_absolute() {
            continue;
        }
        let metadata = fs::symlink_metadata(&current)?;
        if !metadata.is_dir() || is_link(&metadata) {
            return Err(VaultError::new(
                "invalid-path",
                "Choose a real directory, not a file, symbolic link, or junction.",
            ));
        }
    }
    Ok(())
}

fn is_saved_vault(app: &tauri::AppHandle, root: &Path) -> VaultResult<bool> {
    let settings_path = crate::runtime_paths::settings_directory(app)?.join("settings.json");
    let content = match fs::read_to_string(settings_path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error.into()),
    };
    let settings: serde_json::Value = serde_json::from_str(&content).map_err(|_| {
        VaultError::new(
            "invalid-path",
            "Settings could not be read. Choose a folder again.",
        )
    })?;
    Ok(settings
        .get("vaultPath")
        .and_then(|path| path.as_str())
        .is_some_and(|path| Path::new(path) == root))
}

fn check_writable(root: &Path) -> VaultResult<()> {
    let probe = root.join(format!(".anehalo-{}.tmp", uuid::Uuid::new_v4()));
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe)?;
    let written = file.write_all(b"Anehalo access check.");
    drop(file);
    let removed = fs::remove_file(probe);
    match (written, removed) {
        (Ok(()), Ok(())) => Ok(()),
        (Err(error), Err(_cleanup_error)) => {
            let mut failure = VaultError::from(error);
            failure
                .message
                .push_str(" The access-check file could not be removed.");
            Err(failure)
        }
        (Err(error), Ok(())) | (Ok(()), Err(error)) => Err(error.into()),
    }
}

pub fn authorize_vault(app: &tauri::AppHandle, root: &Path, create: bool) -> VaultResult<()> {
    validate_path(root)?;
    let normalized = root.to_string_lossy().replace('\\', "/").to_lowercase();
    #[cfg(debug_assertions)]
    if let Some(isolated_root) = crate::runtime_paths::test_root() {
        let isolated_root = isolated_root
            .to_string_lossy()
            .replace('\\', "/")
            .to_lowercase();
        if !normalized.starts_with(&format!("{}/", isolated_root.trim_end_matches('/'))) {
            return Err(VaultError::new(
                "permission-denied",
                "Isolated tests can use only their own temporary notes folders.",
            ));
        }
    }
    for variable in [
        "WINDIR",
        "SYSTEMROOT",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "ProgramData",
        "APPDATA",
        "LOCALAPPDATA",
    ] {
        if let Some(protected) = std::env::var_os(variable) {
            let protected = protected
                .to_string_lossy()
                .replace('\\', "/")
                .to_lowercase();
            let protected = protected.trim_end_matches('/');
            if !protected.is_empty()
                && (normalized == protected || normalized.starts_with(&format!("{protected}/")))
            {
                return Err(VaultError::new(
                    "invalid-path",
                    "Choose a personal folder outside Windows, Program Files, ProgramData, and AppData.",
                ));
            }
        }
    }
    let default_vault = crate::runtime_paths::default_vault_directory(app)?;
    let selected = app
        .state::<VaultAccess>()
        .selected
        .lock()
        .map_err(|_| {
            VaultError::new(
                "unavailable",
                "Folder selection is unavailable. Restart Anehalo.",
            )
        })?
        .contains(root);
    if root != default_vault
        && !selected
        && !app.fs_scope().is_allowed(root)
        && !is_saved_vault(app, root)?
    {
        return Err(VaultError::new(
            "permission-denied",
            "Choose this location in Anehalo before opening it.",
        ));
    }
    prepare_vault_directory(root, create)?;
    app.fs_scope().allow_directory(root, true).map_err(|_| {
        VaultError::new(
            "permission-denied",
            "Could not grant access to the Anehalo vault.",
        )
    })?;
    Ok(())
}

/// Touches only the vault folder itself and its ancestors' metadata. The parent the user
/// picked can hold any number of unrelated files, so it must never be listed or walked.
fn prepare_vault_directory(root: &Path, create: bool) -> VaultResult<()> {
    validate_path(root)?;
    let parent = root.parent().ok_or_else(|| {
        VaultError::new(
            "invalid-path",
            "Choose a folder inside a drive, not its root.",
        )
    })?;
    require_real_directory(parent)?;
    match fs::symlink_metadata(root) {
        Ok(metadata) if metadata.is_file() => {
            return Err(VaultError::new(
                "invalid-type",
                "A file named Anehalo already exists here. Choose another location.",
            ));
        }
        Ok(_) => require_real_directory(root)?,
        Err(error) if create && error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir(root)?
        }
        Err(error) => return Err(error.into()),
    }
    check_writable(root)
}

#[tauri::command]
pub async fn pick_vault_location(
    app: tauri::AppHandle,
    window: tauri::Window,
) -> VaultResult<Option<String>> {
    tauri::async_runtime::spawn_blocking(move || {
        let chosen = app
            .dialog()
            .file()
            .set_parent(&window)
            .set_title("Choose a location for Anehalo")
            .blocking_pick_folder();
        let Some(chosen) = chosen else {
            return Ok(None);
        };
        let picked = chosen.simplified().into_path().map_err(|_| {
            VaultError::new(
                "invalid-path",
                "Choose a folder on a drive or network share.",
            )
        })?;
        if picked.file_name().is_none() {
            return Err(VaultError::new(
                "invalid-path",
                "Choose a folder inside a drive or network share, not its root.",
            ));
        }
        let vault = if picked
            .file_name()
            .is_some_and(|name| name.to_string_lossy().eq_ignore_ascii_case("Anehalo"))
        {
            picked.clone()
        } else {
            picked.join("Anehalo")
        };
        app.state::<VaultAccess>()
            .selected
            .lock()
            .map_err(|_| VaultError::new("unavailable", "Folder selection is unavailable."))?
            .insert(vault);
        Ok(Some(picked.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|_| VaultError::new("unavailable", "The folder picker could not be opened."))?
}

#[tauri::command]
pub async fn prepare_vault(
    app: tauri::AppHandle,
    vault_path: String,
    create: bool,
) -> VaultResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        authorize_vault(&app, Path::new(&vault_path), create)
    })
    .await
    .map_err(|_| VaultError::new("unavailable", "The notes folder could not be checked."))?
}

#[derive(serde::Serialize)]
pub struct DirectoryEntry {
    name: String,
    r#type: &'static str,
}

#[tauri::command]
pub async fn read_vault_directory(
    app: tauri::AppHandle,
    vault_path: String,
    relative_path: String,
    maximum_entries: usize,
) -> VaultResult<Vec<DirectoryEntry>> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = PathBuf::from(vault_path);
        validate_path(&root)?;
        if !app.fs_scope().is_allowed(&root) {
            return Err(VaultError::new(
                "permission-denied",
                "The vault is not authorized.",
            ));
        }
        let relative = Path::new(&relative_path);
        if relative.is_absolute()
            || relative
                .components()
                .any(|part| !matches!(part, Component::Normal(_)))
        {
            return Err(VaultError::new(
                "invalid-path",
                "The directory must be inside the vault.",
            ));
        }
        let directory = root.join(relative);
        require_real_directory(&directory)?;
        fs::read_dir(directory)?
            .take(maximum_entries.min(20_001))
            .map(|entry| {
                let entry = entry?;
                let metadata = entry.metadata()?;
                Ok(DirectoryEntry {
                    name: entry.file_name().to_string_lossy().into_owned(),
                    r#type: if is_link(&metadata) {
                        "link"
                    } else if metadata.is_dir() {
                        "directory"
                    } else {
                        "file"
                    },
                })
            })
            .collect()
    })
    .await
    .map_err(|_| VaultError::new("unavailable", "The vault directory could not be read."))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    const LARGE_TREE_FOLDERS: usize = 50;
    const LARGE_TREE_SUBFOLDERS: usize = 10;
    const LARGE_TREE_FILES_PER_SUBFOLDER: usize = 10;
    const SETUP_TIME_LIMIT: Duration = Duration::from_secs(2);

    /// Kept out of the system temp folder because vault paths inside AppData are rejected.
    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let path = Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("target")
                .join("vault-access-tests")
                .join(uuid::Uuid::new_v4().to_string());
            fs::create_dir_all(&path).expect("create the test directory");
            Self(path)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            if let Err(error) = fs::remove_dir_all(&self.0) {
                eprintln!("Could not remove {}: {error}", self.0.display());
            }
        }
    }

    fn create_large_tree(parent: &Path) -> usize {
        let mut file_count = 0;
        for folder in 0..LARGE_TREE_FOLDERS {
            for subfolder in 0..LARGE_TREE_SUBFOLDERS {
                let directory = parent
                    .join(format!("Folder {folder}"))
                    .join(format!("Nested {subfolder}"));
                fs::create_dir_all(&directory).expect("create a nested folder");
                for file in 0..LARGE_TREE_FILES_PER_SUBFOLDER {
                    fs::write(directory.join(format!("File {file}.md")), "Unrelated file.")
                        .expect("write an unrelated file");
                    file_count += 1;
                }
            }
        }
        file_count
    }

    /// A folder nobody may list. Any recursive walk of its parent fails on it, which is how
    /// the tests prove that vault setup never walks the folder the user picked.
    #[cfg(windows)]
    struct UnlistableFolder(PathBuf);

    #[cfg(windows)]
    impl UnlistableFolder {
        const EVERYONE: &'static str = "*S-1-1-0";

        fn lock(path: &Path) -> Self {
            fs::create_dir_all(path).expect("create the unlistable folder");
            Self::run_icacls(path, &["/deny", &format!("{}:(RD)", Self::EVERYONE)]);
            assert!(
                fs::read_dir(path).is_err(),
                "the folder must be unlistable for this test to prove anything"
            );
            Self(path.to_path_buf())
        }

        fn run_icacls(path: &Path, arguments: &[&str]) {
            let status = std::process::Command::new("icacls")
                .arg(path)
                .args(arguments)
                .stdout(std::process::Stdio::null())
                .status()
                .expect("run icacls");
            assert!(status.success(), "icacls {arguments:?} failed");
        }
    }

    #[cfg(windows)]
    impl Drop for UnlistableFolder {
        fn drop(&mut self) {
            Self::run_icacls(&self.0, &["/remove:d", Self::EVERYONE]);
        }
    }

    fn list_tree(directory: &Path) -> Vec<(PathBuf, u64)> {
        let mut entries = Vec::new();
        let mut pending = vec![directory.to_path_buf()];
        while let Some(current) = pending.pop() {
            for entry in fs::read_dir(&current).expect("list a test folder") {
                let entry = entry.expect("read a test entry");
                let metadata = entry.metadata().expect("read test metadata");
                let path = entry.path();
                if metadata.is_dir() {
                    pending.push(path.clone());
                }
                let relative = path
                    .strip_prefix(directory)
                    .expect("entry inside the tree")
                    .to_path_buf();
                entries.push((relative, metadata.len()));
            }
        }
        entries.sort();
        entries
    }

    #[test]
    fn preparing_a_vault_in_a_large_folder_creates_only_the_anehalo_child() {
        let test_directory = TestDirectory::new();
        let parent = test_directory.0.join("Large library");
        let file_count = create_large_tree(&parent);
        assert_eq!(file_count, 5_000);
        let tree_before = list_tree(&parent);

        #[cfg(windows)]
        let walk_trap = UnlistableFolder::lock(&parent.join("Folder 49").join("Nested 9"));
        let started = Instant::now();
        let result = prepare_vault_directory(&parent.join("Anehalo"), true);
        let elapsed = started.elapsed();
        #[cfg(windows)]
        drop(walk_trap);

        assert!(result.is_ok(), "vault setup failed: {:?}", result.err());
        assert!(
            elapsed < SETUP_TIME_LIMIT,
            "vault setup took {elapsed:?} for a parent with {file_count} files"
        );
        let vault = parent.join("Anehalo");
        assert!(vault.is_dir());
        assert_eq!(
            fs::read_dir(&vault).expect("list the vault").count(),
            0,
            "the access check must not leave files behind"
        );
        let mut tree_after = list_tree(&parent);
        tree_after.retain(|(path, _)| path != Path::new("Anehalo"));
        assert_eq!(tree_after, tree_before, "files outside the vault changed");
    }

    #[test]
    fn preparing_the_parent_itself_is_refused_without_creating_anything() {
        let test_directory = TestDirectory::new();
        let parent = test_directory.0.join("Large library");
        create_large_tree(&parent);
        let tree_before = list_tree(&parent);

        let error = prepare_vault_directory(&parent, true).expect_err("parent must be refused");

        assert_eq!(error.code, "legacy-vault");
        assert_eq!(list_tree(&parent), tree_before);
    }

    #[test]
    fn an_existing_anehalo_folder_is_reused_in_any_case_without_nesting() {
        let test_directory = TestDirectory::new();
        let vault = test_directory.0.join("Restored notes").join("aNeHaLo");
        fs::create_dir_all(&vault).expect("create the copied vault");
        fs::write(vault.join("Restored.md"), "Keep me.").expect("write a note");

        prepare_vault_directory(&vault, false).expect("reuse the copied vault");

        let names: Vec<_> = fs::read_dir(&vault)
            .expect("list the vault")
            .map(|entry| entry.expect("read an entry").file_name())
            .collect();
        assert_eq!(names, vec![std::ffi::OsString::from("Restored.md")]);
    }

    #[test]
    fn a_missing_vault_is_not_created_unless_requested() {
        let test_directory = TestDirectory::new();
        let vault = test_directory.0.join("Anehalo");

        let error = prepare_vault_directory(&vault, false).expect_err("missing vault");

        assert_eq!(error.code, "not-found");
        assert!(!vault.exists());
    }
}
