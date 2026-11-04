#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_fs::init());

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());

    if let Err(error) = builder.run(tauri::generate_context!()) {
        eprintln!("Unable to run Anehalo: {error}");
        std::process::exit(1);
    }
}
