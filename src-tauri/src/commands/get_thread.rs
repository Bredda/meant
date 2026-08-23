use tauri::{State};
use serde::Serialize;

use crate::{
    db::models::{Thread, ThreadMessage},
    AppState,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadData {
    pub thread: Thread,
    pub messages: Vec<ThreadMessage>,
}

#[tauri::command]
pub fn get_thread(
    state: State<'_, AppState>,
    thread_id: String,
) -> Result<ThreadData, String> {
    let thread = state
        .threads
        .get_thread(&thread_id)?
        .ok_or_else(|| format!("Thread not found: {thread_id}"))?;

    let messages = state
        .threads
        .get_messages(&thread_id)?;

    Ok(ThreadData {
        thread,
        messages,
    })
}