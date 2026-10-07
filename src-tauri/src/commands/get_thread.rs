use serde::Serialize;
use tauri::State;

use crate::{
    db::models::{RunSummary, StoredThreadMessage, Thread},
    error::AppError,
    AppState,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadData {
    pub thread: Thread,
    pub messages: Vec<StoredThreadMessage>,
    pub runs: Vec<RunSummary>,
}

#[tauri::command]
pub fn get_thread(state: State<'_, AppState>, thread_id: String) -> Result<ThreadData, AppError> {
    let thread = state
        .threads
        .get_thread(&thread_id)?
        .ok_or_else(|| AppError::NotFound(format!("Thread {thread_id}")))?;

    let messages = state.threads.get_messages(&thread_id)?;
    let runs = state.threads.list_runs(&thread_id)?;

    Ok(ThreadData {
        thread,
        messages,
        runs,
    })
}
