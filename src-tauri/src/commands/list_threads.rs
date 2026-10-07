use tauri::State;

use crate::{db::models::Thread, error::AppError, AppState};
#[tauri::command]
pub fn list_threads(state: State<'_, AppState>) -> Result<Vec<Thread>, AppError> {
    Ok(state.threads.list_threads()?)
}
