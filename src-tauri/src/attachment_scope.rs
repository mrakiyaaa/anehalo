use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_fs::FsExt;

#[tauri::command]
pub fn prepare_attachment_scope(app: tauri::AppHandle, vault_path: String) -> Result<(), String> {
    let vault = PathBuf::from(&vault_path)
        .canonicalize()
        .map_err(|error| format!("Could not locate the notes folder: {error}"))?;
    let default_vault = app
        .path()
        .document_dir()
        .map_err(|error| format!("Could not locate Documents: {error}"))?
        .join("Anehalo");
    let is_default = default_vault.canonicalize().is_ok_and(|path| path == vault);
    if !is_default && !app.fs_scope().is_allowed(&vault) {
        return Err("Choose this notes folder in Anehalo before loading its images.".into());
    }
    let attachments = vault.join(".attachments");
    if attachments.exists() {
        let resolved = attachments
            .canonicalize()
            .map_err(|error| format!("Could not locate attachments: {error}"))?;
        if resolved.parent() != Some(vault.as_path()) || !resolved.is_dir() {
            return Err("Attachments must be a real directory inside the notes folder.".into());
        }
    }
    app.asset_protocol_scope()
        .allow_directory(attachments, true)
        .map_err(|error| format!("Could not allow attachment images: {error}"))
}
