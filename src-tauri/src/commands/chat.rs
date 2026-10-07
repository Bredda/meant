use tauri::{ipc::Channel, AppHandle, State};

use crate::{
    ai::{
        agent::types::{AgentEvent, ThreadMessage},
        provider, title,
    },
    db::models::{NewMessage, NewRun, StoredThreadMessage},
    error::AppError,
    runs::{
        registry::CancelSignal,
        service::{Run, RunStatus},
    },
    AppState,
};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub thread_id: Option<String>,
    pub input: String,
}

/// What a run answers.
pub enum RunTarget {
    /// A new user message, stored before the model is called.
    Send { input: String },
    /// The thread's last user message again: the previous answer is replaced
    /// once the new one exists.
    Regenerate,
}

#[tauri::command]
pub async fn chat(
    app: AppHandle,
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
            let thread = state
                .threads
                .create_thread(&provisional_title(&request.input))?;

            channel.send(AgentEvent::ThreadCreated {
                thread: thread.clone(),
                run_id: run_id.clone(),
            })?;

            thread
        }
    };

    run_in_thread(
        &app,
        &state,
        &channel,
        &thread.id,
        &run_id,
        RunTarget::Send {
            input: request.input,
        },
    )
    .await
}

/// Records, runs and closes one run on an existing thread. Shared by `chat`
/// and `regenerate`.
pub async fn run_in_thread(
    app: &AppHandle,
    state: &State<'_, AppState>,
    channel: &Channel<AgentEvent>,
    thread_id: &str,
    run_id: &str,
    target: RunTarget,
) -> Result<(), AppError> {
    // TODO: no per-thread/per-message provider selection exists yet; this
    // picks whichever configured provider comes first. Replace once threads
    // (or the composer) can express which provider a run should use.
    // Resolved before anything is written, so a missing key leaves no trace.
    let provider = state.default_provider()?;

    // Held until the run row is closed below, so the thread counts as running
    // for the whole run.
    let (_registration, cancel) = state
        .runs
        .register(run_id, thread_id)
        .map_err(|_| AppError::InvalidInput("This thread already has a run in progress".into()))?;

    state.threads.start_run(&NewRun {
        id: run_id.to_string(),
        thread_id: thread_id.to_string(),
        provider: provider.id().to_string(),
        model: provider::model_id(provider).to_string(),
    })?;

    let result = execute_run(state, channel, run_id, thread_id, provider, target, cancel).await;

    // The run row must leave `running` whatever happened; a failure to record
    // that must not hide the run's own outcome.
    let (status, error) = match &result {
        Ok(status) => (status.clone(), None),
        Err(error) => (RunStatus::Failed, Some(error.to_string())),
    };
    if let Err(error) = state
        .threads
        .finish_run(run_id, status.as_str(), error.as_deref())
    {
        eprintln!("could not record the outcome of run {run_id}: {error}");
    }

    // Once the run is closed, so naming the thread never holds it up. A
    // stopped or failed run has no answer worth a title.
    if status == RunStatus::Completed && error.is_none() {
        title::spawn_generation(app.clone(), thread_id.to_string(), provider);
    }

    result.map(|_| ())
}

/// How the run's output reaches the database.
enum Persist {
    /// After the user message stored for this run.
    Append { user_message: StoredThreadMessage },
    /// Over what followed the message at `position`, which stays the
    /// previous answer (`previous`) if the run ends with nothing to show.
    Replace {
        position: i64,
        previous: Vec<StoredThreadMessage>,
    },
}

/// Runs the agent and stores what it produced. Returns how the run ended:
/// `Completed`, or `Cancelled` when the user stopped it (what it had produced
/// is stored all the same).
async fn execute_run(
    state: &State<'_, AppState>,
    channel: &Channel<AgentEvent>,
    run_id: &str,
    thread_id: &str,
    provider: crate::vault::secrets::ProviderId,
    target: RunTarget,
    cancel: CancelSignal,
) -> Result<RunStatus, AppError> {
    let (history, persist) = match target {
        RunTarget::Send { input } => {
            // Persisted before the model runs: the user's input survives a
            // failed run.
            let user_message = state.threads.add_message(
                thread_id,
                Some(run_id),
                &NewMessage {
                    id: uuid::Uuid::new_v4().to_string(),
                    role: "user",
                    content: input,
                    tool_call_id: None,
                    tool_name: None,
                    is_error: false,
                },
            )?;

            (
                state.threads.get_messages(thread_id)?,
                Persist::Append { user_message },
            )
        }

        RunTarget::Regenerate => {
            let mut rows = state.threads.get_messages(thread_id)?;
            let index = regeneration_point(&rows)
                .ok_or_else(|| AppError::InvalidInput("There is nothing to regenerate".into()))?;
            let position = rows[index].position;
            let previous = rows.split_off(index + 1);

            // The old answer stays in the database until the new one replaces it.
            (rows, Persist::Replace { position, previous })
        }
    };

    let messages = history
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
            cancel,
            Box::new({
                let channel = channel.clone();
                move |event| {
                    let _ = channel.send(event);
                }
            }),
        )
        .await?;

    let status = run_result.outcome.status();
    let produced = run_result
        .messages
        .into_iter()
        .map(to_new_message)
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();

    // One transaction: the run's output is stored entirely or not at all.
    let persisted_messages = match persist {
        Persist::Append { user_message } => {
            let mut persisted = vec![user_message];
            persisted.extend(
                state
                    .threads
                    .append_messages(thread_id, Some(run_id), &produced)?,
            );
            persisted
        }

        // Stopped before anything was produced: keep the answer the user had
        // rather than replacing it with nothing.
        Persist::Replace { previous, .. }
            if produced.is_empty() && status == RunStatus::Cancelled =>
        {
            previous
        }

        Persist::Replace { position, .. } => state
            .threads
            .replace_messages_after(thread_id, position, run_id, &produced)?,
    };

    channel.send(AgentEvent::RunCompleted {
        thread_id: thread_id.to_string(),
        run_id: run_id.to_string(),
        status: status.clone(),
        messages: persisted_messages,
    })?;

    Ok(status)
}

/// Index of the user message a regenerated run answers: the last one.
pub fn regeneration_point(messages: &[StoredThreadMessage]) -> Option<usize> {
    messages.iter().rposition(|message| message.role == "user")
}

const PROVISIONAL_TITLE_CHARS: usize = 50;

/// The title a thread carries until a better one exists: the start of its
/// first message, on one line.
fn provisional_title(input: &str) -> String {
    let first_line = input
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("");

    if first_line.is_empty() {
        return "New thread".to_string();
    }

    let mut chars = first_line.chars();
    let title: String = chars.by_ref().take(PROVISIONAL_TITLE_CHARS).collect();
    if chars.next().is_some() {
        format!("{}…", title.trim_end())
    } else {
        title
    }
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
            is_error: false,
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
            is_error: false,
        },

        ThreadMessage::ToolResult {
            id,
            tool_call_id,
            tool_name,
            content,
            is_error,
        } => NewMessage {
            id,
            role: "tool_result",
            content,
            tool_call_id: Some(tool_call_id),
            tool_name: Some(tool_name),
            is_error,
        },

        ThreadMessage::User { .. } => return Ok(None),
    };

    Ok(Some(message))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_short_message_is_its_own_title() {
        assert_eq!(provisional_title("  Hello there  "), "Hello there");
    }

    #[test]
    fn only_the_first_non_empty_line_counts() {
        assert_eq!(provisional_title("\n\nFirst line\nSecond"), "First line");
    }

    #[test]
    fn a_long_message_is_cut_on_a_character_boundary() {
        let title = provisional_title(&"é".repeat(80));

        assert_eq!(title.chars().count(), PROVISIONAL_TITLE_CHARS + 1);
        assert!(title.ends_with('…'));
    }

    #[test]
    fn a_blank_message_falls_back_to_a_placeholder() {
        assert_eq!(provisional_title(" \n "), "New thread");
    }
}

#[cfg(test)]
mod regeneration_tests {
    use super::*;

    fn row(id: &str, role: &str, position: i64) -> StoredThreadMessage {
        StoredThreadMessage {
            id: id.into(),
            position,
            created_at: 0,
            thread_id: "t1".into(),
            run_id: None,
            role: role.into(),
            content: id.into(),
            tool_call_id: None,
            tool_name: None,
            is_error: false,
        }
    }

    #[test]
    fn the_last_user_message_is_the_one_answered_again() {
        let rows = [
            row("u1", "user", 0),
            row("a1", "assistant", 1),
            row("u2", "user", 2),
            row("c1", "tool_call", 3),
            row("r1", "tool_result", 4),
            row("a2", "assistant", 5),
        ];

        assert_eq!(regeneration_point(&rows), Some(2));
    }

    #[test]
    fn a_thread_without_a_user_message_has_nothing_to_regenerate() {
        assert_eq!(regeneration_point(&[]), None);
        assert_eq!(regeneration_point(&[row("a1", "assistant", 0)]), None);
    }
}
