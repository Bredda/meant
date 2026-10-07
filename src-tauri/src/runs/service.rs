use crate::ai::agent::{
    runtime::{AgentContext, AgentEmitter, AgentError, AgentRuntime, RunResult},
    types::{AgentEvent, ThreadMessage},
};

use serde::Serialize;

// Only `Running` is used until runs are persisted (fixes.md R4).
#[allow(dead_code)]
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
        let context = AgentContext { messages };

        match self.agent.run(&run, context, &emit).await {
            Ok(result) => Ok(result),

            // The single place a run failure reaches the UI: runtimes only
            // return the error, and the frontend ignores the matching
            // `invoke` rejection once this event has ended the run.
            Err(error) => {
                emit(AgentEvent::Error {
                    run_id: run.id.clone(),
                    thread_id: Some(run.thread_id.clone()),
                    kind: error.kind(),
                    message: error.to_string(),
                });
                Err(error)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use super::*;

    struct FailingRuntime;

    #[async_trait::async_trait]
    impl AgentRuntime for FailingRuntime {
        async fn run(
            &self,
            _run: &Run,
            _context: AgentContext,
            _emit: &AgentEmitter,
        ) -> Result<RunResult, AgentError> {
            Err(AgentError::Provider("invalid key".into()))
        }
    }

    #[test]
    fn a_failed_run_emits_exactly_one_error_event() {
        let events = Arc::new(Mutex::new(Vec::new()));
        let emit: AgentEmitter = Box::new({
            let events = Arc::clone(&events);
            move |event| events.lock().unwrap().push(event)
        });
        let run = Run {
            id: "r1".into(),
            thread_id: "t1".into(),
            status: RunStatus::Running,
        };

        let result =
            tauri::async_runtime::block_on(RunService::new(FailingRuntime).run(run, vec![], emit));

        assert!(matches!(result, Err(AgentError::Provider(_))));
        let events = events.lock().unwrap();
        assert_eq!(events.len(), 1);
        assert!(matches!(events[0], AgentEvent::Error { .. }));
    }
}
