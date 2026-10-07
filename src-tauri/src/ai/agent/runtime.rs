use async_trait::async_trait;

use crate::ai::agent::types::{AgentEvent, ThreadMessage};

use crate::error::ErrorKind;
use crate::runs::service::Run;

#[derive(Debug, Clone)]
pub struct AgentContext {
    pub messages: Vec<ThreadMessage>,
}

#[derive(Debug, Clone)]
pub struct RunResult {
    pub messages: Vec<ThreadMessage>,
}

#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    /// The model provider could not be used or answered with an error
    /// (missing or rejected key, network, rate limit).
    #[error("Provider error: {0}")]
    Provider(String),

    #[error("Runtime error: {0}")]
    Runtime(String),
}

impl AgentError {
    pub fn kind(&self) -> ErrorKind {
        match self {
            Self::Provider(_) => ErrorKind::Provider,
            Self::Runtime(_) => ErrorKind::Internal,
        }
    }
}

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
