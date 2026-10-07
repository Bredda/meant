use serde::Serialize;

use crate::{
    ai::agent::runtime::AgentError,
    db::models::{StoredThreadMessage, Thread},
    error::ErrorKind,
};

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data", rename_all_fields = "camelCase")]
pub enum AgentEvent {
    ThreadCreated {
        thread: Thread,
        run_id: String,
    },
    RunStarted {
        thread_id: String,
        run_id: String,
    },
    MessageStarted {
        thread_id: String,
        run_id: String,
        message_id: String,
    },
    MessageDelta {
        thread_id: String,
        run_id: String,
        message_id: String,
        text: String,
    },
    MessageCompleted {
        thread_id: String,
        run_id: String,
        message_id: String,
    },
    ToolCallStarted {
        thread_id: String,
        run_id: String,
        tool_call_id: String,
        tool_name: String,
        arguments: String,
    },
    ToolCallCompleted {
        thread_id: String,
        run_id: String,
        tool_call_id: String,
        tool_name: String,
        content: String,
        is_error: bool,
    },
    RunCompleted {
        thread_id: String,
        run_id: String,
        messages: Vec<StoredThreadMessage>,
    },
    Error {
        thread_id: Option<String>,
        run_id: String,
        kind: ErrorKind,
        message: String,
    },
}

#[derive(Debug, Clone)]
pub enum ThreadMessage {
    User {
        // Not read when replaying history, kept so every variant carries its row id.
        #[allow(dead_code)]
        id: String,
        content: String,
    },

    Assistant {
        id: String,
        content: String,
    },

    ToolCall {
        id: String,
        tool_call_id: String,
        tool_name: String,
        arguments: serde_json::Value,
    },

    ToolResult {
        id: String,
        tool_call_id: String,
        tool_name: String,
        /// The text the model sees, stored as is.
        content: String,
    },
}

impl TryFrom<StoredThreadMessage> for ThreadMessage {
    type Error = AgentError;

    fn try_from(message: StoredThreadMessage) -> Result<Self, Self::Error> {
        match message.role.as_str() {
            "user" => Ok(ThreadMessage::User {
                id: message.id,
                content: message.content,
            }),

            "assistant" => Ok(ThreadMessage::Assistant {
                id: message.id,
                content: message.content,
            }),

            "tool_call" => {
                let tool_call_id = message.tool_call_id.ok_or_else(|| {
                    AgentError::Runtime("Tool call message is missing tool_call_id".into())
                })?;

                let tool_name = message.tool_name.ok_or_else(|| {
                    AgentError::Runtime("Tool call message is missing tool_name".into())
                })?;

                let arguments = serde_json::from_str(&message.content).map_err(|e| {
                    AgentError::Runtime(format!("Invalid tool call arguments: {e}"))
                })?;

                Ok(ThreadMessage::ToolCall {
                    id: message.id,
                    tool_call_id,
                    tool_name,
                    arguments,
                })
            }

            "tool_result" => {
                let tool_call_id = message.tool_call_id.ok_or_else(|| {
                    AgentError::Runtime("Tool result message is missing tool_call_id".into())
                })?;

                let tool_name = message.tool_name.ok_or_else(|| {
                    AgentError::Runtime("Tool result message is missing tool_name".into())
                })?;

                let content = stored_tool_result_text(message.content);

                Ok(ThreadMessage::ToolResult {
                    id: message.id,
                    tool_call_id,
                    tool_name,
                    content,
                })
            }

            role => Err(AgentError::Runtime(format!(
                "Unknown thread message role: {role}"
            ))),
        }
    }
}

/// Rows written before tool results were stored as text hold rig's serialized
/// content (`[{"type":"text","text":"..."}]`): unwrap those, keep the rest.
fn stored_tool_result_text(raw: String) -> String {
    let Ok(serde_json::Value::Array(parts)) = serde_json::from_str::<serde_json::Value>(&raw)
    else {
        return raw;
    };

    let texts: Option<Vec<&str>> = parts
        .iter()
        .map(|part| part.get("text").and_then(serde_json::Value::as_str))
        .collect();

    match texts {
        Some(texts) => texts.join("\n"),
        None => raw,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stored_result(content: &str) -> StoredThreadMessage {
        StoredThreadMessage {
            id: "m1".into(),
            position: 0,
            created_at: 0,
            thread_id: "t1".into(),
            run_id: None,
            role: "tool_result".into(),
            content: content.into(),
            tool_call_id: Some("c1".into()),
            tool_name: Some("echo".into()),
        }
    }

    fn content_of(message: ThreadMessage) -> String {
        match message {
            ThreadMessage::ToolResult { content, .. } => content,
            other => panic!("expected a tool result, got {other:?}"),
        }
    }

    #[test]
    fn ipc_payloads_are_camel_case() {
        let event = AgentEvent::ToolCallCompleted {
            thread_id: "t1".into(),
            run_id: "r1".into(),
            tool_call_id: "c1".into(),
            tool_name: "echo".into(),
            content: "hi".into(),
            is_error: false,
        };
        let message = serde_json::to_value(stored_result("hi")).unwrap();

        assert_eq!(
            serde_json::to_value(event).unwrap(),
            serde_json::json!({
                "type": "ToolCallCompleted",
                "data": {
                    "threadId": "t1", "runId": "r1", "toolCallId": "c1",
                    "toolName": "echo", "content": "hi", "isError": false
                }
            })
        );
        assert!(message.get("threadId").is_some() && message.get("toolCallId").is_some());
    }

    #[test]
    fn tool_result_text_is_loaded_as_is() {
        let message = ThreadMessage::try_from(stored_result("hello")).unwrap();

        assert_eq!(content_of(message), "hello");
    }

    #[test]
    fn legacy_rig_serialized_tool_result_is_unwrapped() {
        let legacy = r#"[{"type":"text","text":"hello"}]"#;

        let message = ThreadMessage::try_from(stored_result(legacy)).unwrap();

        assert_eq!(content_of(message), "hello");
    }

    #[test]
    fn json_tool_output_is_not_mistaken_for_legacy_rows() {
        let json = r#"[{"id":1}]"#;

        let message = ThreadMessage::try_from(stored_result(json)).unwrap();

        assert_eq!(content_of(message), json);
    }
}
