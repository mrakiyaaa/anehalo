mod attachment_scope;
mod desktop_tray;
mod export_commands;
mod export_transaction;
mod launch_arguments;
mod navigation_guard;
mod runtime_paths;
mod startup_timeline;
mod vault_access;
mod vault_error;
mod vault_snapshot;

use tauri::Manager;

/// Isolated E2E runs need a DevTools port for Playwright. Some WebView2 runtimes ignore the
/// WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS variable, so the debug build passes the switch itself.
/// Setting arguments replaces wry's defaults, so those are repeated here. Port 0 lets WebView2
/// choose a free port and record it in the profile's DevToolsActivePort file.
#[cfg(debug_assertions)]
const E2E_BROWSER_ARGUMENTS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection \
    --autoplay-policy=no-user-gesture-required --remote-debugging-port=0";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(startup_timeline::StartupTimeline::starting_now())
        .on_page_load(|webview, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Started {
                webview
                    .state::<startup_timeline::StartupTimeline>()
                    .record_page_load_started();
            }
        })
        .manage(launch_arguments::LaunchArguments::new(
            std::env::args().skip(1).collect(),
        ))
        .manage(vault_access::VaultAccess::default());
    let context = tauri::generate_context!();
    #[cfg(debug_assertions)]
    let context = {
        let mut context = context;
        if let Some(root) = runtime_paths::test_root() {
            let config = context.config_mut();
            config.app.app_directories_override = Some(
                tauri::utils::config::AppDirectoriesOverride::Root(root.join("runtime")),
            );
            for window in &mut config.app.windows {
                window.additional_browser_args = Some(E2E_BROWSER_ARGUMENTS.into());
            }
            if runtime_paths::test_single_instance() {
                config.identifier = runtime_paths::isolated_identifier(&config.identifier, &root);
            }
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
    let builder = if runtime_paths::test_root().is_none() || runtime_paths::test_single_instance() {
        builder.plugin(single_instance)
    } else {
        builder
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
        // Its injected click handler would send `_blank` links straight to the browser, around
        // the window's new-window guard and openWebLink's checks and logging.
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            attachment_scope::prepare_attachment_scope,
            export_commands::write_note_export,
            runtime_paths::runtime_paths,
            startup_timeline::startup_timeline,
            launch_arguments::initial_arguments,
            launch_arguments::take_pending_arguments,
            vault_snapshot::read_vault_snapshot,
            vault_access::pick_vault_location,
            vault_access::prepare_vault,
            vault_access::read_vault_directory
        ]);

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // Updates are checked and installed from the web UI; see src/features/updates.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--autostart"])
                .build(),
        )
        .plugin(startup_timeline::plugins_initialized_marker())
        .setup(|app| {
            app.state::<startup_timeline::StartupTimeline>()
                .record_setup_started();
            runtime_paths::prepare(app)?;
            navigation_guard::create_main_window(app)?;
            std::panic::set_hook(Box::new(|_| log::error!("event=native-panic")));
            let tray = desktop_tray::setup(app);
            app.state::<startup_timeline::StartupTimeline>()
                .record_setup_completed();
            tray
        });

    if let Err(error) = builder.run(context) {
        eprintln!("Unable to run Anehalo: {error}");
        std::process::exit(1);
    }
}
