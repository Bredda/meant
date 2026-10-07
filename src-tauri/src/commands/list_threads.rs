use tauri::State;

use crate::{db::models::Thread, AppState};
#[tauri::command]
pub fn list_threads(state: State<'_, AppState>) -> Result<Vec<Thread>, String> {
    state.threads.list_threads()
}
