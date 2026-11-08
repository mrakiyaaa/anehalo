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
    check_writable(root)?;
    app.fs_scope().allow_directory(root, true).map_err(|_| {
        VaultError::new(
            "permission-denied",
            "Could not grant access to the Anehalo vault.",
        )
    })?;
    Ok(())
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
