use futures::StreamExt;
use rig::{
    agent::MultiTurnStreamItem,
    completion::{message::UserContent, AssistantContent, Message},
    message::ToolResultContent,
    streaming::{StreamedAssistantContent, StreamedUserContent::ToolResult, StreamingChat},
};

use super::{
    runtime::{AgentContext, AgentEmitter, AgentError, AgentRuntime, RunResult},
    types::{AgentEvent, ThreadMessage},
};
use crate::runs::service::Run;

pub struct ReActAgent {
    agent: rig::agent::Agent,
}

impl ReActAgent {
    /// Wraps an already-assembled agent.
    ///
    /// Provider selection, credential lookup, and builder config (preamble,
    /// tools, turn budget) all happen in `crate::ai::provider::build_agent`;
    /// by the time an `Agent` reaches here it is provider-agnostic, so this
    /// runtime doesn't need to be either.
    pub fn new(agent: rig::agent::Agent) -> Self {
        Self { agent }
    }
}

#[async_trait::async_trait]
impl AgentRuntime for ReActAgent {
    async fn run(
        &self,
        run: &Run,
        context: AgentContext,
        emit: &AgentEmitter,
    ) -> Result<RunResult, AgentError> {
        let messages = context.messages;
        let last_message = messages
            .last()
            .ok_or_else(|| AgentError::Runtime("Conversation is empty".into()))?;

        let history = &messages[..messages.len() - 1];

        let chat_history = history
            .iter()
            .map(to_rig_message)
            .collect::<Result<Vec<_>, _>>()?;

        let prompt = match last_message {
            ThreadMessage::User { content, .. } => content,

            _ => {
                return Err(AgentError::Runtime(
                    "Run must end with a user message".into(),
                ));
            }
        };

        emit(AgentEvent::RunStarted {
            run_id: run.id.clone(),
            thread_id: run.thread_id.clone(),
        });

        let mut stream = self.agent.stream_chat(prompt, chat_history).await;

        let mut produced_messages: Vec<ThreadMessage> = vec![];
        let mut current_message: Option<(String, String)> = None; // (message_id, buffer)

        macro_rules! close_current_message {
            () => {
                if let Some((message_id, text)) = current_message.take() {
                    emit(AgentEvent::MessageCompleted {
                        run_id: run.id.clone(),
                        thread_id: run.thread_id.clone(),
                        message_id: message_id.clone(),
                    });
                    produced_messages.push(ThreadMessage::Assistant {
                        id: message_id,
                        content: text,
                    });
                }
            };
        }

        while let Some(item) = stream.next().await {
            let item = match item {
                Ok(item) => item,
                // RunService reports the failure to the UI; emitting here too
                // would show the same error twice.
                Err(e) => return Err(stream_error(e)),
            };

            match item {
                MultiTurnStreamItem::StreamAssistantItem(content) => match content {
                    StreamedAssistantContent::Text(text) => {
                        let message_id = match &current_message {
                            Some((id, _)) => id.clone(),
                            None => {
                                let id = uuid::Uuid::new_v4().to_string();
                                emit(AgentEvent::MessageStarted {
                                    run_id: run.id.clone(),
                                    thread_id: run.thread_id.clone(),
                                    message_id: id.clone(),
                                });
                                current_message = Some((id.clone(), String::new()));
                                id
                            }
                        };

                        if let Some((_, buf)) = current_message.as_mut() {
                            buf.push_str(&text.text);
                        }

                        emit(AgentEvent::MessageDelta {
                            run_id: run.id.clone(),
                            thread_id: run.thread_id.clone(),
                            message_id,
                            text: text.text,
                        });
                    }
                    StreamedAssistantContent::ToolCallDelta { .. } => {}
                    _ => {}
                },

                MultiTurnStreamItem::ToolExecutionCommitted {
                    tool_call,
                    internal_call_id,
                } => {
                    close_current_message!(); // ferme le segment texte s'il y en avait un avant l'appel d'outil

                    produced_messages.push(ThreadMessage::ToolCall {
                        id: uuid::Uuid::new_v4().to_string(),
                        tool_call_id: internal_call_id.clone(),
                        tool_name: tool_call.function.name.clone(),
                        arguments: tool_call.function.arguments.clone(),
                    });
                    emit(AgentEvent::ToolCallStarted {
                        run_id: run.id.clone(),
                        thread_id: run.thread_id.clone(),
                        tool_name: tool_call.function.name.clone(),
                        tool_call_id: internal_call_id.clone(),
                        arguments: tool_call.function.arguments.to_string(),
                    });
                }

                MultiTurnStreamItem::StreamUserItem(ToolResult {
                    tool_result,
                    internal_call_id,
                }) => {
                    let content = tool_result_text(&tool_result.content);

                    produced_messages.push(ThreadMessage::ToolResult {
                        id: uuid::Uuid::new_v4().to_string(),
                        tool_call_id: internal_call_id.clone(),
                        tool_name: tool_result.name.clone(),
                        content: content.clone(),
                    });
                    emit(AgentEvent::ToolCallCompleted {
                        run_id: run.id.clone(),
                        thread_id: run.thread_id.clone(),
                        tool_name: tool_result.name.clone(),
                        tool_call_id: internal_call_id.clone(),
                        content,
                        is_error: false,
                    });
                }

                MultiTurnStreamItem::FinalResponse(_) => {}

                _ => {}
            }
        }

        // Close last segment if exists
        close_current_message!();

        Ok(RunResult {
            messages: produced_messages,
        })
    }
}

fn to_rig_message(message: &ThreadMessage) -> Result<Message, AgentError> {
    match message {
        ThreadMessage::User { content, .. } => Ok(Message::User {
            content: vec![UserContent::text(content.clone())],
        }),

        ThreadMessage::Assistant { content, .. } => Ok(Message::Assistant {
            id: None,
            content: vec![AssistantContent::text(content.clone())],
        }),

        ThreadMessage::ToolCall {
            tool_call_id,
            tool_name,
            arguments,
            ..
        } => Ok(Message::Assistant {
            id: None,
            content: vec![AssistantContent::tool_call(
                tool_call_id.clone(),
                tool_name.clone(),
                arguments.clone(),
            )],
        }),

        ThreadMessage::ToolResult {
            tool_call_id,
            tool_name,
            content,
            ..
        } => Ok(Message::User {
            content: vec![UserContent::tool_result(
                tool_call_id.clone(),
                tool_name.clone(),
                vec![ToolResultContent::text(content.clone())],
            )],
        }),
    }
}

/// Flattens a tool's output to the text replayed to the model on later turns
/// and shown in the UI. Storing rig's own serialization instead would make the
/// model read `[{"type":"text",...}]` rather than the tool's answer.
fn tool_result_text(content: &[ToolResultContent]) -> String {
    content
        .iter()
        .map(|part| match part {
            ToolResultContent::Text(text) => text.text.clone(),
            ToolResultContent::Json { value } => value.to_string(),
            ToolResultContent::Image(_) => "[image]".to_string(),
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// A failed completion means the provider could not be used (rejected key,
/// network, rate limit): the UI points the user to Settings for those.
fn stream_error(error: rig::agent::StreamingError) -> AgentError {
    use rig::{agent::StreamingError, completion::PromptError};

    match error {
        StreamingError::Completion(_) => AgentError::Provider(error.to_string()),
        StreamingError::Prompt(ref prompt)
            if matches!(**prompt, PromptError::CompletionError(_)) =>
        {
            AgentError::Provider(error.to_string())
        }
        StreamingError::Prompt(_) => AgentError::Runtime(error.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tool_result_text_joins_parts_as_plain_text() {
        let content = vec![
            ToolResultContent::text("hello"),
            ToolResultContent::Json {
                value: serde_json::json!({ "n": 1 }),
            },
        ];

        assert_eq!(tool_result_text(&content), "hello\n{\"n\":1}");
    }

    #[test]
    fn tool_result_replays_its_text_to_the_model() {
        let message = ThreadMessage::ToolResult {
            id: "m1".into(),
            tool_call_id: "c1".into(),
            tool_name: "echo".into(),
            content: "hello".into(),
        };

        let replayed = serde_json::to_string(&to_rig_message(&message).unwrap()).unwrap();

        assert!(replayed.contains(r#""text":"hello""#), "{replayed}");
        assert!(!replayed.contains(r#"\"text\""#), "{replayed}");
    }
}
