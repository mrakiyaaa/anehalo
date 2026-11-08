use crate::{
    vault_access::{authorize_vault, is_link},
    vault_error::{VaultError, VaultResult},
};
use std::{fs, path::PathBuf};
use tauri::Manager;

#[tauri::command]
pub fn prepare_attachment_scope(app: tauri::AppHandle, vault_path: String) -> VaultResult<()> {
    let root = PathBuf::from(vault_path);
    authorize_vault(&app, &root, false)?;
    let vault = root.canonicalize()?;
    let attachments = vault.join(".attachments");
    match fs::symlink_metadata(&attachments) {
        Ok(metadata) => {
            if is_link(&metadata)
                || !metadata.is_dir()
                || attachments.canonicalize()?.parent() != Some(vault.as_path())
            {
                return Err(VaultError::new(
                    "invalid-path",
                    "Attachments must be a real directory inside the vault.",
                ));
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.into()),
    }
    app.asset_protocol_scope()
        .allow_directory(attachments, true)
        .map_err(|_| {
            VaultError::new(
                "permission-denied",
                "Could not allow the vault attachment images.",
            )
        })
}
