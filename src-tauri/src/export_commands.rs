use crate::export_transaction::{ExportAsset, commit_export};
use std::path::{Component, PathBuf};
use tauri_plugin_fs::FsExt;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportRequest {
    path: String,
    content_length: usize,
    assets: Vec<AssetRequest>,
}
#[derive(serde::Deserialize)]
struct AssetRequest {
    name: String,
    length: usize,
}

#[tauri::command]
pub async fn write_note_export(
    app: tauri::AppHandle,
    request: tauri::ipc::Request<'_>,
) -> Result<(), String> {
    let metadata = request
        .headers()
        .get("x-anehalo-export")
        .and_then(|value| value.to_str().ok())
        .ok_or("Missing export information.")?;
    let decoded = percent_encoding::percent_decode_str(metadata)
        .decode_utf8()
        .map_err(|error| error.to_string())?;
    let metadata: ExportRequest =
        serde_json::from_str(&decoded).map_err(|error| error.to_string())?;
    let tauri::ipc::InvokeBody::Raw(body) = request.body() else {
        return Err("Invalid export data.".into());
    };
    let path = PathBuf::from(&metadata.path);
    if !path.is_absolute()
        || path
            .components()
            .any(|part| matches!(part, Component::ParentDir))
        || !app.fs_scope().is_allowed(&path)
    {
        return Err("Choose the export file with Anehalo's save dialog first.".into());
    }
    if !matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some("md" | "pdf")
    ) {
        return Err("Choose a Markdown or PDF destination.".into());
    }
    let parent = path
        .parent()
        .ok_or("Missing export folder.")?
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let destination = parent.join(path.file_name().ok_or("Missing export name.")?);
    let content = body
        .get(..metadata.content_length)
        .ok_or("Invalid export length.")?
        .to_vec();
    let mut offset = metadata.content_length;
    let mut assets = Vec::new();
    for asset in metadata.assets {
        let end = offset
            .checked_add(asset.length)
            .ok_or("Invalid image length.")?;
        let bytes = body.get(offset..end).ok_or("Invalid image data.")?.to_vec();
        assets.push(ExportAsset {
            name: asset.name,
            bytes,
        });
        offset = end;
    }
    if offset != body.len() {
        return Err("Unexpected export data.".into());
    }
    tauri::async_runtime::spawn_blocking(move || commit_export(&destination, &content, &assets))
        .await
        .map_err(|error| error.to_string())?
}
