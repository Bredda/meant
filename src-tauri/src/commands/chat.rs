use tauri::{ipc::Channel, State};

use crate::{
    AppState, ai::agent::types::{AgentEvent, ThreadMessage}, db::models::StoredThreadMessage, runs::service::{Run, RunStatus},
};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub thread_id: Option<String>,
    pub input: String,
    pub model: String, // Eg. "anthropic/claude-sonnet-4.6" or "openai/gpt-5.1"
    pub tools: Vec<String>, // Eg. ["echo"]
}

#[tauri::command]
pub async fn chat(
    state: State<'_, AppState>,
    request: ChatRequest,
    channel: Channel<AgentEvent>,
) -> Result<(), String> {
    let run_id = uuid::Uuid::new_v4().to_string();

    // Retrieves or creates thread based on optional request thread_id
    let thread = match request.thread_id {
        Some(thread_id) => state
            .threads
            .get_thread(&thread_id)?
            .ok_or_else(|| format!("Thread not found: {thread_id}"))?,

        None => {
            let thread = state.threads.create_thread()?;

            channel
                .send(AgentEvent::ThreadCreated {
                    thread: thread.clone(),
                    run_id: run_id.clone(),
                })
                .map_err(|e| e.to_string())?;

            thread
        }
    };

    // Produces and persists user message
    let user_message_id = uuid::Uuid::new_v4().to_string();

    let stored_user_message = state.threads.add_message(
        &thread.id,
        &user_message_id,
        "user",
        &request.input,
        None,
        None,
    )?;

    // Produces thread history
    let stored_messages = state.threads.get_messages(&thread.id)?;

    let messages = stored_messages
        .into_iter()
        .map(ThreadMessage::try_from)
        .collect::<Result<Vec<_>, _>>()?;

    // Runs agent
    let run = Run {
        id: run_id.clone(),
        thread_id: thread.id.clone(),
        status: RunStatus::Running,
    };

    // TODO: no per-thread/per-message provider selection exists yet; this
    // picks whichever configured provider comes first. Replace once threads
    // (or the composer) can express which provider a run should use.
    let provider = state.default_provider()?;

    let run_result = state
        .agent(provider)
        .await?
        .run(
            run,
            messages,
            Box::new({
                let channel = channel.clone();
                move |event| {
                    let _ = channel.send(event);
                }
            }),
        )
        .await?;

    // Persists the whole message stack (user message already persisted above)
    let mut persisted_messages = vec![stored_user_message];

    for message in run_result.messages {
        if let Some(stored) = persist_thread_message(&state, &thread.id, message)? {
            persisted_messages.push(stored);
        }
    }

    // Emit final event with all persisted messages
    channel
        .send(AgentEvent::RunCompleted {
            thread_id: thread.id.clone(),
            run_id: run_id.clone(),
            messages: persisted_messages,
        })
        .map_err(|e| e.to_string())?;

    Ok(())
}


/// Maps a produced `ThreadMessage` to a stored row, or `None` for kinds
/// that are already persisted upstream (e.g. `User`).
fn persist_thread_message(
    state: &State<'_, AppState>,
    thread_id: &str,
    message: ThreadMessage,
) -> Result<Option<StoredThreadMessage>, String> {
    let (id, role, content, tool_call_id, tool_name) = match message {
        ThreadMessage::Assistant { id, content } => (id, "assistant", content, None, None),

        ThreadMessage::ToolCall {
            id,
            tool_call_id,
            tool_name,
            arguments,
        } => (
            id,
            "tool_call",
            serde_json::to_string(&arguments).map_err(|e| e.to_string())?,
            Some(tool_call_id),
            Some(tool_name),
        ),

        ThreadMessage::ToolResult {
            id,
            tool_call_id,
            tool_name,
            content,
        } => (
            id,
            "tool_result",
            serde_json::to_string(&content).map_err(|e| e.to_string())?,
            Some(tool_call_id),
            Some(tool_name),
        ),

        ThreadMessage::User { .. } => return Ok(None),
    };

    let stored = state.threads.add_message(
        thread_id,
        &id,
        role,
        &content,
        tool_call_id.as_deref(),
        tool_name.as_deref(),
    )?;

    Ok(Some(stored))
}