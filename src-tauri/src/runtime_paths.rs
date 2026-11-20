use crate::vault_error::{VaultError, VaultResult};
use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager;

pub fn settings_directory(app: &tauri::AppHandle) -> VaultResult<PathBuf> {
    #[cfg(debug_assertions)]
    if let Some(root) = test_root() {
        return Ok(root.join("settings"));
    }
    app.path()
        .app_config_dir()
        .map_err(|_| VaultError::new("unavailable", "App settings are unavailable."))
}

pub fn default_vault_directory(app: &tauri::AppHandle) -> VaultResult<PathBuf> {
    #[cfg(debug_assertions)]
    if let Some(root) = test_root() {
        return Ok(root.join("Anehalo"));
    }
    app.path()
        .document_dir()
        .map(|path| path.join("Anehalo"))
        .map_err(|_| VaultError::new("unavailable", "Documents is unavailable."))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePaths {
    vault: PathBuf,
    settings: PathBuf,
    isolated: bool,
}

#[cfg(debug_assertions)]
pub fn test_root() -> Option<PathBuf> {
    std::env::var_os("ANEHALO_TEST_ROOT").map(PathBuf::from)
}

/// Isolated runs leave single-instance off, so a relaunch can never be mistaken for a second
/// instance of the one being stopped. The test of forwarded launch arguments turns it on.
#[cfg(debug_assertions)]
pub fn test_single_instance() -> bool {
    std::env::var_os("ANEHALO_TEST_SINGLE_INSTANCE").is_some()
}

/// An app identifier unique to one test root, so a test's single-instance lock never reaches
/// the user's own Anehalo or another test run.
#[cfg(debug_assertions)]
pub fn isolated_identifier(identifier: &str, root: &std::path::Path) -> String {
    // FNV-1a: stable across runs, unlike the standard library's randomly seeded hasher.
    let hash = root
        .as_os_str()
        .as_encoded_bytes()
        .iter()
        .fold(0xcbf2_9ce4_8422_2325_u64, |hash, byte| {
            (hash ^ u64::from(*byte)).wrapping_mul(0x0100_0000_01b3)
        });
    format!("{identifier}.e2e{hash:016x}")
}

#[tauri::command]
pub fn runtime_paths(app: tauri::AppHandle) -> Result<RuntimePaths, String> {
    #[cfg(debug_assertions)]
    if let Some(root) = test_root() {
        if !root.is_absolute() {
            return Err("The isolated test root must be absolute.".into());
        }
        return Ok(RuntimePaths {
            vault: root.join("Anehalo"),
            settings: root.join("settings"),
            isolated: true,
        });
    }
    Ok(RuntimePaths {
        vault: app
            .path()
            .document_dir()
            .map_err(|_| "Documents is unavailable.")?
            .join("Anehalo"),
        settings: app
            .path()
            .app_config_dir()
            .map_err(|_| "App settings are unavailable.")?,
        isolated: false,
    })
}

pub fn prepare(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(debug_assertions)]
    if let Some(root) = test_root() {
        if !root.is_absolute() {
            return Err("The isolated test root must be absolute.".into());
        }
        for directory in [root.join("Anehalo"), root.join("settings")] {
            std::fs::create_dir_all(&directory)?;
            tauri_plugin_fs::FsExt::fs_scope(app).allow_directory(&directory, true)?;
        }
    }
    let _ = app;
    Ok(())
}

#[cfg(all(test, debug_assertions))]
mod tests {
    use super::isolated_identifier;
    use std::path::Path;

    #[test]
    fn isolated_identifiers_are_stable_and_unique_per_test_root() {
        let first = isolated_identifier("me.lakshitha.anehalo", Path::new("C:/Temp/run-1"));
        assert_eq!(
            first,
            isolated_identifier("me.lakshitha.anehalo", Path::new("C:/Temp/run-1"))
        );
        assert_ne!(
            first,
            isolated_identifier("me.lakshitha.anehalo", Path::new("C:/Temp/run-2"))
        );
        assert!(first.starts_with("me.lakshitha.anehalo.e2e"));
        assert!(
            first
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || character == '.')
        );
    }
}
