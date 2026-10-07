use tauri::{ipc::Channel, State};

use crate::{
    ai::{
        agent::types::{AgentEvent, ThreadMessage},
        provider,
    },
    db::models::{NewMessage, NewRun, StoredThreadMessage},
    error::AppError,
    runs::service::{Run, RunStatus},
    AppState,
};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub thread_id: Option<String>,
    pub input: String,
}

#[tauri::command]
pub async fn chat(
    state: State<'_, AppState>,
    request: ChatRequest,
    channel: Channel<AgentEvent>,
) -> Result<(), AppError> {
    let run_id = uuid::Uuid::new_v4().to_string();

    // Retrieves or creates thread based on optional request thread_id
    let thread = match request.thread_id {
        Some(thread_id) => state
            .threads
            .get_thread(&thread_id)?
            .ok_or_else(|| AppError::NotFound(format!("Thread {thread_id}")))?,

        None => {
            let thread = state.threads.create_thread()?;

            channel.send(AgentEvent::ThreadCreated {
                thread: thread.clone(),
                run_id: run_id.clone(),
            })?;

            thread
        }
    };

    // TODO: no per-thread/per-message provider selection exists yet; this
    // picks whichever configured provider comes first. Replace once threads
    // (or the composer) can express which provider a run should use.
    // Resolved before anything is written, so a missing key leaves no trace.
    let provider = state.default_provider()?;

    state.threads.start_run(&NewRun {
        id: run_id.clone(),
        thread_id: thread.id.clone(),
        provider: provider.id().to_string(),
        model: provider::model_id(provider).to_string(),
    })?;

    let result = execute_run(
        &state,
        &channel,
        &run_id,
        &thread.id,
        provider,
        request.input,
    )
    .await;

    // The run row must leave `running` whatever happened; a failure to record
    // that must not hide the run's own outcome.
    let (status, error) = match &result {
        Ok(()) => (RunStatus::Completed, None),
        Err(error) => (RunStatus::Failed, Some(error.to_string())),
    };
    if let Err(error) = state
        .threads
        .finish_run(&run_id, status.as_str(), error.as_deref())
    {
        eprintln!("could not record the outcome of run {run_id}: {error}");
    }

    result
}

async fn execute_run(
    state: &State<'_, AppState>,
    channel: &Channel<AgentEvent>,
    run_id: &str,
    thread_id: &str,
    provider: crate::vault::secrets::ProviderId,
    input: String,
) -> Result<(), AppError> {
    // Persisted before the model runs: the user's input survives a failed run.
    let stored_user_message = state.threads.add_message(
        thread_id,
        Some(run_id),
        &NewMessage {
            id: uuid::Uuid::new_v4().to_string(),
            role: "user",
            content: input,
            tool_call_id: None,
            tool_name: None,
        },
    )?;

    let messages = state
        .threads
        .get_messages(thread_id)?
        .into_iter()
        .map(ThreadMessage::try_from)
        .collect::<Result<Vec<_>, _>>()?;

    let run = Run {
        id: run_id.to_string(),
        thread_id: thread_id.to_string(),
        status: RunStatus::Running,
    };

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

    let produced = run_result
        .messages
        .into_iter()
        .map(to_new_message)
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();

    // One transaction: the run's output is stored entirely or not at all.
    let mut persisted_messages: Vec<StoredThreadMessage> = vec![stored_user_message];
    persisted_messages.extend(
        state
            .threads
            .append_messages(thread_id, Some(run_id), &produced)?,
    );

    channel.send(AgentEvent::RunCompleted {
        thread_id: thread_id.to_string(),
        run_id: run_id.to_string(),
        messages: persisted_messages,
    })?;

    Ok(())
}

/// Maps a produced `ThreadMessage` to a row to insert, or `None` for kinds
/// that are already persisted upstream (e.g. `User`).
fn to_new_message(message: ThreadMessage) -> Result<Option<NewMessage>, AppError> {
    let message = match message {
        ThreadMessage::Assistant { id, content } => NewMessage {
            id,
            role: "assistant",
            content,
            tool_call_id: None,
            tool_name: None,
        },

        ThreadMessage::ToolCall {
            id,
            tool_call_id,
            tool_name,
            arguments,
        } => NewMessage {
            id,
            role: "tool_call",
            content: serde_json::to_string(&arguments)?,
            tool_call_id: Some(tool_call_id),
            tool_name: Some(tool_name),
        },

        ThreadMessage::ToolResult {
            id,
            tool_call_id,
            tool_name,
            content,
        } => NewMessage {
            id,
            role: "tool_result",
            content,
            tool_call_id: Some(tool_call_id),
            tool_name: Some(tool_name),
        },

        ThreadMessage::User { .. } => return Ok(None),
    };

    Ok(Some(message))
}
