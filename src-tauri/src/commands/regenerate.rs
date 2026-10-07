use tauri::{ipc::Channel, AppHandle, State};

use crate::{
    ai::agent::types::AgentEvent,
    commands::chat::{run_in_thread, RunTarget},
    error::AppError,
    AppState,
};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegenerateRequest {
    pub thread_id: String,
}

/// Answers the thread's last user message again. It streams and ends exactly
/// like `chat` (same events); `RunCompleted` carries only the new output, and
/// the previous answer is replaced once that output is stored.
#[tauri::command]
pub async fn regenerate(
    app: AppHandle,
    state: State<'_, AppState>,
    request: RegenerateRequest,
    channel: Channel<AgentEvent>,
) -> Result<(), AppError> {
    let thread = state
        .threads
        .get_thread(&request.thread_id)?
        .ok_or_else(|| AppError::NotFound(format!("Thread {}", request.thread_id)))?;

    run_in_thread(
        &app,
        &state,
        &channel,
        &thread.id,
        &uuid::Uuid::new_v4().to_string(),
        RunTarget::Regenerate,
    )
    .await
}
