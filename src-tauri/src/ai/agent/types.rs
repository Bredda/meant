use serde::Serialize;

use crate::{
    ai::agent::runtime::AgentError,
    db::models::{StoredThreadMessage, Thread},
};

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
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
        message: String,
    },
}

#[derive(Debug, Clone)]
pub enum ChatRole {
    User,
    Assistant,
}

#[derive(Debug, Clone)]
pub enum ThreadMessage {
    User {
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
        content: serde_json::Value,
    },
}

impl ThreadMessage {
    pub fn content(&self) -> &str {
        match self {
            Self::User { content, .. } | Self::Assistant { content, .. } => content,

            Self::ToolCall { .. } | Self::ToolResult { .. } => "",
        }
    }
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

                let content = serde_json::from_str(&message.content).map_err(|e| {
                    AgentError::Runtime(format!("Invalid tool result content: {e}"))
                })?;

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
