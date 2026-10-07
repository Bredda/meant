use tauri::State;

use crate::{error::AppError, AppState};

#[tauri::command]
pub fn delete_thread(state: State<'_, AppState>, thread_id: String) -> Result<(), AppError> {
    // The run would write into a thread that no longer exists.
    if state.runs.is_thread_running(&thread_id) {
        return Err(AppError::InvalidInput(
            "Stop the running response before deleting this thread".into(),
        ));
    }

    if state.threads.delete_thread(&thread_id)? {
        Ok(())
    } else {
        Err(AppError::NotFound(format!("Thread {thread_id}")))
    }
}
