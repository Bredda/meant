use tauri::{State};

use crate::{
    db::models::ThreadMessage,
    AppState,
};

#[tauri::command]
pub fn get_thread_messages(
    state: State<'_, AppState>,
    thread_id: String,
) -> Result<Vec<ThreadMessage>, String> {
    state.threads.get_messages(&thread_id)
}