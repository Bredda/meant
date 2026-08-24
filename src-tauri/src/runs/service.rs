use crate::ai::agent::{
        runtime::{
            AgentContext, AgentEmitter, AgentError,  AgentRuntime, RunResult,
        }, types::{AgentEvent, ThreadMessage},
    };

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RunStatus {
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Run {
    pub id: String,
    pub thread_id: String,
    pub status: RunStatus,
}

pub struct RunService<A> {
    agent: A,
}

impl<A> RunService<A>
where
    A: AgentRuntime,
{
    pub fn new(agent: A) -> Self {
        Self { agent }
    }

    pub async fn run(
        &self,
        run: Run,
        messages: Vec<ThreadMessage>,
        emit: AgentEmitter,
    ) -> Result<RunResult, AgentError> {
        let context = AgentContext {
            messages,
        };

        match self
            .agent
            .run(&run, context, &emit)
            .await
        {
            Ok(result) => Ok(result),

            Err(error) => {
                emit(AgentEvent::Error {
                    run_id: run.id.clone(),
                    thread_id: Some(run.thread_id.clone()),
                    message: error.to_string(),
                });
                return Err(AgentError::Runtime(
                    format!("Unexpected error: {}!", error.to_string())
                ));
            }
        }
    }
    
}