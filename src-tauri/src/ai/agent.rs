

use rig::{
    agent::{Agent, MultiTurnStreamItem},
    client::{AgentClientExt, ProviderClient},
    providers::anthropic,
    streaming::{StreamedAssistantContent, StreamingChat},
};
use futures::StreamExt;
use serde::Serialize;

use crate::db::models::Thread;

#[derive(Debug, Clone)]
pub enum ChatRole {
    User,
    Assistant,
}

#[derive(Debug, Clone)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum AgentEvent {
    ThreadCreated {
        thread: Thread,
    },

    RunStarted {
        thread_id: String,
    },

    MessageDelta {
        thread_id: String,
        text: String,
    },

    RunCompleted {
        thread_id: String,
    },

    Error {
        thread_id: Option<String>,
        message: String,
    },
}

pub struct AgentService {
    agent: Agent,
}

fn to_rig_message(
    message: &ChatMessage,
) -> Result<rig::completion::Message, String> {
    match message.role {
        ChatRole::User => {
            Ok(rig::completion::Message::user(
                message.content.clone(),
            ))
        }

        ChatRole::Assistant => {
            Ok(rig::completion::Message::assistant(
                message.content.clone(),
            ))
        }
    }
}

impl AgentService {
    pub fn new() -> Result<Self, String> {
        let client = anthropic::Client::from_env()
            .map_err(|e| e.to_string())?;

        let agent = client
            .agent(anthropic::completion::CLAUDE_SONNET_4_6)
            .preamble(
                "You are a helpful assistant. \
                 Answer clearly and concisely.",
            )
            .build();

        Ok(Self { agent })
    }

    pub async fn run<F>(
        &self,
        thread_id: String,
        messages: Vec<ChatMessage>,
        emit: F,
    ) -> Result<String, String>
    where
        F: Fn(AgentEvent) + Send + Sync,
    {
        emit(AgentEvent::RunStarted {
            thread_id: thread_id.clone(),
        });

        let last_message = messages
            .last()
            .ok_or_else(|| "Conversation is empty".to_string())?;

        let chat_history = messages[..messages.len() - 1]
            .iter()
            .map(to_rig_message)
            .collect::<Result<Vec<_>, _>>()?;

        let prompt = &last_message.content;

        let mut stream = self
            .agent
            .stream_chat(prompt, chat_history)
            .await;

        let mut assistant_content = String::new();

        while let Some(item) = stream.next().await {
            match item.map_err(|e| e.to_string())? {
                MultiTurnStreamItem::StreamAssistantItem(
                    StreamedAssistantContent::Text(text),
                ) => {
                    assistant_content.push_str(&text.text);

                    emit(AgentEvent::MessageDelta {
                        thread_id: thread_id.clone(),
                        text: text.text,
                    });
                }

                MultiTurnStreamItem::FinalResponse(_) => {}

                _ => {}
            }
        }

        emit(AgentEvent::RunCompleted {
            thread_id,
        });

        Ok(assistant_content)
    }
}