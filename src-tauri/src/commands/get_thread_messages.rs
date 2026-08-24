use tauri::{State};

use crate::{
    db::models::StoredThreadMessage,
    AppState,
};

#[tauri::command]
pub fn get_thread_messages(
    state: State<'_, AppState>,
    thread_id: String,
) -> Result<Vec<StoredThreadMessage>, String> {
    state.threads.get_messages(&thread_id)
}