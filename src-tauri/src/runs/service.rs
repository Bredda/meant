use crate::ai::agent::{
    runtime::{AgentContext, AgentEmitter, AgentError, AgentRuntime, RunResult},
    types::{AgentEvent, ThreadMessage},
};

use serde::Serialize;

use super::registry::CancelSignal;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RunStatus {
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl RunStatus {
    /// Value stored in `runs.status`.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }
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
        cancel: CancelSignal,
        emit: AgentEmitter,
    ) -> Result<RunResult, AgentError> {
        let context = AgentContext { messages, cancel };

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
    use crate::ai::agent::runtime::RunOutcome;

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

        let result = tauri::async_runtime::block_on(RunService::new(FailingRuntime).run(
            run,
            vec![],
            CancelSignal::never(),
            emit,
        ));

        assert!(matches!(result, Err(AgentError::Provider(_))));
        let events = events.lock().unwrap();
        assert_eq!(events.len(), 1);
        assert!(matches!(events[0], AgentEvent::Error { .. }));
    }

    /// Waits for the stop request, as a runtime blocked on the model would.
    struct WaitsForCancel;

    #[async_trait::async_trait]
    impl AgentRuntime for WaitsForCancel {
        async fn run(
            &self,
            _run: &Run,
            mut context: AgentContext,
            _emit: &AgentEmitter,
        ) -> Result<RunResult, AgentError> {
            context.cancel.cancelled().await;
            Ok(RunResult {
                messages: vec![],
                outcome: RunOutcome::Cancelled,
            })
        }
    }

    #[test]
    fn a_stopped_run_ends_as_cancelled_without_an_error_event() {
        let registry = crate::runs::registry::RunRegistry::default();
        let (_guard, cancel) = registry.register("r1", "t1").unwrap();
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
        registry.cancel("r1");

        let result = tauri::async_runtime::block_on(RunService::new(WaitsForCancel).run(
            run,
            vec![],
            cancel,
            emit,
        ))
        .unwrap();

        assert_eq!(result.outcome.status().as_str(), "cancelled");
        assert!(events.lock().unwrap().is_empty());
    }
}
