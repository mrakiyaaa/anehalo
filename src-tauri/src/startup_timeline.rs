use serde::Serialize;
use std::{
    sync::OnceLock,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{Manager, Runtime, plugin::TauriPlugin};

/// Wall-clock times (Unix milliseconds) of the native startup steps. The web page's own
/// performance marks start at navigation, so these cover the time before the page exists.
#[derive(Default)]
pub struct StartupTimeline {
    process_entered: OnceLock<f64>,
    plugins_initialized: OnceLock<f64>,
    setup_started: OnceLock<f64>,
    setup_completed: OnceLock<f64>,
    page_load_started: OnceLock<f64>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StartupTimelineSnapshot {
    process_entered: Option<f64>,
    plugins_initialized: Option<f64>,
    setup_started: Option<f64>,
    setup_completed: Option<f64>,
    page_load_started: Option<f64>,
}

fn unix_milliseconds(time: SystemTime) -> f64 {
    time.duration_since(UNIX_EPOCH)
        .map_or(0.0, |elapsed| elapsed.as_secs_f64() * 1000.0)
}

/// Keeps the first time only, because reloads repeat these steps after the cold start.
fn record_once(slot: &OnceLock<f64>, time: SystemTime) {
    let _ = slot.set(unix_milliseconds(time));
}

impl StartupTimeline {
    pub fn starting_now() -> Self {
        let timeline = Self::default();
        record_once(&timeline.process_entered, SystemTime::now());
        timeline
    }

    pub fn record_plugins_initialized(&self) {
        record_once(&self.plugins_initialized, SystemTime::now());
    }

    /// Tauri creates the configured window, and with it WebView2, before the setup hook runs.
    pub fn record_setup_started(&self) {
        record_once(&self.setup_started, SystemTime::now());
    }

    pub fn record_setup_completed(&self) {
        record_once(&self.setup_completed, SystemTime::now());
    }

    pub fn record_page_load_started(&self) {
        record_once(&self.page_load_started, SystemTime::now());
    }

    fn snapshot(&self) -> StartupTimelineSnapshot {
        StartupTimelineSnapshot {
            process_entered: self.process_entered.get().copied(),
            plugins_initialized: self.plugins_initialized.get().copied(),
            setup_started: self.setup_started.get().copied(),
            setup_completed: self.setup_completed.get().copied(),
            page_load_started: self.page_load_started.get().copied(),
        }
    }
}

/// Plugins initialize in registration order, so registering this one last marks the moment all
/// others are ready, before Tauri starts the event loop and creates the window.
pub fn plugins_initialized_marker<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("startup-timeline")
        .setup(|app, _api| {
            app.state::<StartupTimeline>().record_plugins_initialized();
            Ok(())
        })
        .build()
}

#[tauri::command]
pub fn startup_timeline(state: tauri::State<'_, StartupTimeline>) -> StartupTimelineSnapshot {
    state.snapshot()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn each_step_keeps_its_first_time() {
        let timeline = StartupTimeline::default();
        let first = UNIX_EPOCH + Duration::from_millis(1_000);
        record_once(&timeline.setup_completed, first);
        record_once(
            &timeline.setup_completed,
            first + Duration::from_millis(500),
        );

        assert_eq!(
            timeline.snapshot(),
            StartupTimelineSnapshot {
                process_entered: None,
                plugins_initialized: None,
                setup_started: None,
                setup_completed: Some(1_000.0),
                page_load_started: None,
            }
        );
    }

    #[test]
    fn starting_now_records_process_entry() {
        let timeline = StartupTimeline::starting_now();
        let snapshot = timeline.snapshot();

        assert!(snapshot.process_entered.is_some_and(|time| time > 0.0));
        assert_eq!(snapshot.setup_completed, None);
    }
}
