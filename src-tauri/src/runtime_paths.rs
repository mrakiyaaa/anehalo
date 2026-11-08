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
