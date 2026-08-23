use tauri::{ipc::Channel, State};

use crate::{
    ai::agent::{AgentEvent, ChatMessage, ChatRole},
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
) -> Result<(), String> {
    println!("New chat request");
    // Retrieves or creates thread based on optional request thread_id
    let thread = match request.thread_id {
        Some(thread_id) => {
            state
                .threads
                .get_thread(&thread_id)?
                .ok_or_else(|| {
                    format!("Thread not found: {thread_id}")
                })?
        }

        None => {
            let thread = state.threads.create_thread()?;

            channel
                .send(AgentEvent::ThreadCreated {
                    thread: thread.clone(),
                })
                .map_err(|e| e.to_string())?;

            thread
        }
    };

    // Produces and persists user message
    let user_message_id = uuid::Uuid::new_v4().to_string();

    state.threads.add_message(
        &thread.id,
        &user_message_id,
        "user",
        &request.input,
    )?;

    // Produces thread history
    let stored_messages =
        state.threads.get_messages(&thread.id)?;

    let messages = stored_messages
        .into_iter()
        .map(|message| {
            let role = match message.role.as_str() {
                "user" => ChatRole::User,
                "assistant" => ChatRole::Assistant,
                role => {
                    return Err(format!(
                        "Unknown message role: {role}"
                    ));
                }
            };

            Ok(ChatMessage {
                role,
                content: message.content,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    // Runs agent
    let thread_id = uuid::Uuid::new_v4().to_string();

    let result = state
        .agent
        .run(thread_id.clone(), messages, |event| {
            let _ = channel.send(event);
        })
        .await;

    let assistant_content = match result {
        Ok(content) => content,

        Err(error) => {
            let _ = channel.send(AgentEvent::Error {
                thread_id: Some(thread_id),
                message: error,
            });

            return Ok(());
        }
    };

    // Persists final assistant message
    let assistant_message_id =
        uuid::Uuid::new_v4().to_string();

    state.threads.add_message(
        &thread.id,
        &assistant_message_id,
        "assistant",
        &assistant_content,
    )?;

    Ok(())
}