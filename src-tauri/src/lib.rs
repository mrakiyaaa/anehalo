mod desktop_tray;
mod attachment_scope;
mod export_commands;
mod export_transaction;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _arguments, _directory| {
        if let Err(error) = desktop_tray::show_main_window(app) {
            eprintln!("Could not restore Anehalo: {error}");
        }
    }));

    let builder = builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            attachment_scope::prepare_attachment_scope,
            export_commands::write_note_export
        ]);

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().args(["--autostart"]).build())
        .setup(|app| desktop_tray::setup(app));

    if let Err(error) = builder.run(tauri::generate_context!()) {
        eprintln!("Unable to run Anehalo: {error}");
        std::process::exit(1);
    }
}
