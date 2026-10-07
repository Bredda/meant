use async_trait::async_trait;

use crate::ai::agent::types::{AgentEvent, ThreadMessage};

use crate::runs::service::Run;

#[derive(Debug, Clone)]
pub struct AgentContext {
    pub messages: Vec<ThreadMessage>,
}

#[derive(Debug, Clone)]
pub struct RunResult {
    pub messages: Vec<ThreadMessage>,
}

#[derive(Debug)]
pub enum AgentError {
    InvalidContext(String),
    Provider(String),
    Runtime(String),
}

impl From<String> for AgentError {
    fn from(value: String) -> Self {
        Self::Runtime(value)
    }
}

impl From<AgentError> for String {
    fn from(value: AgentError) -> Self {
        match value {
            AgentError::InvalidContext(s) => format!("invalid context: {s}"),
            AgentError::Provider(s) => format!("provider error: {s}"),
            AgentError::Runtime(s) => format!("runtime error: {s}"),
        }
    }
}

impl std::fmt::Display for AgentError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidContext(message) => {
                write!(f, "Invalid context: {message}")
            }

            Self::Provider(message) => {
                write!(f, "Provider error: {message}")
            }

            Self::Runtime(message) => {
                write!(f, "Runtime error: {message}")
            }
        }
    }
}

impl std::error::Error for AgentError {}

pub type AgentEmitter = Box<dyn Fn(AgentEvent) + Send + Sync>;

#[async_trait]
pub trait AgentRuntime: Send + Sync {
    async fn run(
        &self,
        run: &Run,
        context: AgentContext,
        emit: &AgentEmitter,
    ) -> Result<RunResult, AgentError>;
}
