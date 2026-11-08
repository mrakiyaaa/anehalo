use std::sync::Mutex;
use tauri::{Emitter, Manager};

pub struct LaunchArguments {
    initial: Vec<String>,
    pending: Mutex<Vec<Vec<String>>>,
}

impl LaunchArguments {
    pub fn new(initial: Vec<String>) -> Self {
        Self {
            pending: Mutex::new(vec![initial.clone()]),
            initial,
        }
    }
}

pub fn forward(app: &tauri::AppHandle, arguments: Vec<String>) -> Result<(), String> {
    app.state::<LaunchArguments>()
        .pending
        .lock()
        .map_err(|_| "The launch action queue is unavailable.")?
        .push(arguments);
    app.emit("anehalo:arguments", ())
        .map_err(|_| "Could not notify Anehalo of the launch action.".into())
}

#[tauri::command]
pub fn initial_arguments(state: tauri::State<'_, LaunchArguments>) -> Vec<String> {
    state.initial.clone()
}

#[tauri::command]
pub fn take_pending_arguments(
    state: tauri::State<'_, LaunchArguments>,
) -> Result<Vec<Vec<String>>, String> {
    let mut pending = state
        .pending
        .lock()
        .map_err(|_| "The launch action queue is unavailable.")?;
    Ok(std::mem::take(&mut *pending))
}
