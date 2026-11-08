mod attachment_scope;
mod desktop_tray;
mod export_commands;
mod export_transaction;
mod launch_arguments;
mod runtime_paths;
mod vault_snapshot;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().manage(launch_arguments::LaunchArguments::new(
        std::env::args().skip(1).collect(),
    ));
    let context = tauri::generate_context!();
    #[cfg(debug_assertions)]
    let context = {
        let mut context = context;
        if let Some(root) = runtime_paths::test_root() {
            context.config_mut().app.app_directories_override = Some(
                tauri::utils::config::AppDirectoriesOverride::Root(root.join("runtime")),
            );
        }
        context
    };

    #[cfg(desktop)]
    let single_instance = tauri_plugin_single_instance::init(|app, arguments, _directory| {
        if launch_arguments::forward(app, arguments.into_iter().skip(1).collect()).is_err() {
            log::error!("event=launch-forward-failed");
        }
    });
    #[cfg(all(desktop, debug_assertions))]
    let builder = if runtime_paths::test_root().is_some() {
        builder
    } else {
        builder.plugin(single_instance)
    };
    #[cfg(all(desktop, not(debug_assertions)))]
    let builder = builder.plugin(single_instance);

    let builder = builder
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("anehalo".into()),
                    },
                )])
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Info
                } else {
                    log::LevelFilter::Warn
                })
                .max_file_size(1_000_000)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(3))
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            attachment_scope::prepare_attachment_scope,
            export_commands::write_note_export,
            runtime_paths::runtime_paths,
            launch_arguments::initial_arguments,
            launch_arguments::take_pending_arguments,
            vault_snapshot::read_vault_snapshot
        ]);

    #[cfg(debug_assertions)]
    let builder = if runtime_paths::test_root().is_some() {
        builder
    } else {
        builder.plugin(tauri_plugin_persisted_scope::init())
    };
    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_persisted_scope::init());

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--autostart"])
                .build(),
        )
        .setup(|app| {
            runtime_paths::prepare(app)?;
            std::panic::set_hook(Box::new(|_| log::error!("event=native-panic")));
            desktop_tray::setup(app)
        });

    if let Err(error) = builder.run(context) {
        eprintln!("Unable to run Anehalo: {error}");
        std::process::exit(1);
    }
}
