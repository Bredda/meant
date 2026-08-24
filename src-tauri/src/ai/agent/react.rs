use futures::StreamExt;
use rig::{
    agent::{
        MultiTurnStreamItem
    }, 
    client::{
        AgentClientExt, 
        ProviderClient
    }, 
    message::ToolResultContent, 
    providers::anthropic, 
    streaming::{
        StreamedAssistantContent, 
        StreamedUserContent::ToolResult, 
        StreamingChat,
    },
    completion::{
        AssistantContent,
        Message,
        message::UserContent,
    }
};

use crate::{
    runs::service::Run,
    ai::tools::echo::Echo
};
use super::{
    types::{
        AgentEvent, 
        ThreadMessage
    },
    runtime::{
        AgentContext,
        AgentEmitter,
        AgentError,
        RunResult,
        AgentRuntime,
    }
};

pub struct ReActAgent {
    agent: rig::agent::Agent,
}

impl ReActAgent {
    pub fn new() -> Result<Self, AgentError> {
        let client =
            anthropic::Client::from_env()
                .map_err(|e| {
                    AgentError::Provider(
                        e.to_string(),
                    )
                })?;

        let  builder = client
            .agent(
                anthropic::completion::CLAUDE_SONNET_4_6,
            )
            .preamble(
                "You are a helpful assistant. \
                 Answer clearly and concisely.",
            ).default_max_turns(5) .tool(Echo);

        // Tools will be registered here.

        let agent = builder.build();

        Ok(Self { agent })
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
            thread_id: run.thread_id.clone()
        });

        let mut stream = self
            .agent
            .stream_chat(
                prompt,
                chat_history,
            )
            .await;

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
                Err(e) => {
                    emit(AgentEvent::Error {
                        run_id: run.id.clone(),
                        thread_id: Some(run.thread_id.clone()),
                        message: e.to_string(),
                    });
                    return Err(AgentError::Runtime(e.to_string()));
                }
            };

            match item {

                MultiTurnStreamItem::StreamAssistantItem(content) => {
                    match content {
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
                    }
                }

                MultiTurnStreamItem::ToolExecutionCommitted { tool_call, internal_call_id } => {
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
                    internal_call_id 
                }) => {
                    let content_value = serde_json::to_value(&tool_result.content)
                        .map_err(|e| AgentError::Runtime(e.to_string()))?;

                    produced_messages.push(ThreadMessage::ToolResult {
                        id: uuid::Uuid::new_v4().to_string(),
                        tool_call_id: internal_call_id.clone(),
                        tool_name: tool_result.name.clone(),
                        content: content_value.clone(),
                    });
                    emit(AgentEvent::ToolCallCompleted {
                        run_id: run.id.clone(),
                        thread_id: run.thread_id.clone(),
                        tool_name: tool_result.name.clone(),
                        tool_call_id: internal_call_id.clone(),
                        content: content_value.to_string(),
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

fn to_rig_message(
    message: &ThreadMessage,
) -> Result<Message, AgentError> {
    match message {
        ThreadMessage::User { content, .. } => {
            Ok(Message::User {
                content: vec![
                    UserContent::text(content.clone())
                ],
            })
        }

        ThreadMessage::Assistant { content, .. } => {
            Ok(Message::Assistant {
                id: None,
                content: vec![
                    AssistantContent::text(content.clone())
                ],
            })
        }

        ThreadMessage::ToolCall {
            tool_call_id,
            tool_name,
            arguments,
            ..
        } => {
            Ok(Message::Assistant {
                id: None,
                content: vec![
                    AssistantContent::tool_call(
                        tool_call_id.clone(),
                        tool_name.clone(),
                        arguments.clone(),
                    ),
                ],
            })
        }

        ThreadMessage::ToolResult {
            tool_call_id,
            tool_name,
            content,
            ..
        } => Ok(Message::User {
            content: vec![UserContent::tool_result(
                tool_call_id.clone(),
                tool_name.clone(),
                vec![ToolResultContent::text(content.to_string())],
            )],
        }),
    }
}
