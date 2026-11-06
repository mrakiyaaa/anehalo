#[cfg(desktop)]
use tauri::{Emitter, Manager};

#[cfg(desktop)]
pub fn show_main_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.unminimize()?;
        window.set_focus()?;
    }
    Ok(())
}

#[cfg(desktop)]
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let quick_note = MenuItem::with_id(app, "quick-note", "New quick note", true, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Open Anehalo", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quick_note, &open, &settings, &quit])?;
    let icon = app.default_window_icon().ok_or("The application icon is missing")?.clone();
    TrayIconBuilder::with_id("anehalo-tray")
        .icon(icon)
        .tooltip("Anehalo")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let action = event.id.as_ref();
            if action != "quit" {
                if let Err(error) = show_main_window(app) {
                    eprintln!("Could not restore Anehalo: {error}");
                }
            }
            if matches!(action, "quick-note" | "settings" | "quit") {
                if let Err(error) = app.emit("anehalo:tray", action) {
                    eprintln!("Could not dispatch tray action: {error}");
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(event, TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. }) {
                if let Err(error) = show_main_window(tray.app_handle()) {
                    eprintln!("Could not restore Anehalo: {error}");
                }
            }
        })
        .build(app)?;
    if !std::env::args().any(|argument| argument == "--autostart") {
        show_main_window(app.handle())?;
    }
    Ok(())
}
