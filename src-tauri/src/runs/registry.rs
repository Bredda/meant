use std::{
    collections::HashMap,
    sync::{Arc, Mutex, MutexGuard, PoisonError},
};

use futures::channel::oneshot;

/// A thread already has a run in progress.
#[derive(Debug, PartialEq, Eq)]
pub struct ThreadBusy;

struct ActiveRun {
    thread_id: String,
    /// Taken by the first `cancel`, so cancelling twice is a no-op.
    cancel: Option<oneshot::Sender<()>>,
}

/// The runs in progress, so a command can stop one from outside its task.
///
/// A thread runs one run at a time: the UI already blocks a second send, this
/// is the backend's own guarantee.
#[derive(Clone, Default)]
pub struct RunRegistry {
    active: Arc<Mutex<HashMap<String, ActiveRun>>>,
}

impl RunRegistry {
    // The map holds plain data that stays consistent if a holder panicked.
    fn lock(&self) -> MutexGuard<'_, HashMap<String, ActiveRun>> {
        self.active.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Records a run as active. The guard removes it when dropped, whatever
    /// way the run ends; the signal resolves when [`RunRegistry::cancel`] is
    /// called for it.
    pub fn register(
        &self,
        run_id: &str,
        thread_id: &str,
    ) -> Result<(RunGuard, CancelSignal), ThreadBusy> {
        let mut active = self.lock();
        if active.values().any(|run| run.thread_id == thread_id) {
            return Err(ThreadBusy);
        }

        let (sender, receiver) = oneshot::channel();
        active.insert(
            run_id.to_string(),
            ActiveRun {
                thread_id: thread_id.to_string(),
                cancel: Some(sender),
            },
        );

        Ok((
            RunGuard {
                registry: self.clone(),
                run_id: run_id.to_string(),
            },
            CancelSignal(receiver),
        ))
    }

    /// Asks a run to stop. A run that already ended (or never existed) is not
    /// an error: the user's click may simply have lost the race.
    pub fn cancel(&self, run_id: &str) {
        let sender = self
            .lock()
            .get_mut(run_id)
            .and_then(|run| run.cancel.take());

        if let Some(sender) = sender {
            // The receiver is gone only if the run is finishing anyway.
            let _ = sender.send(());
        }
    }

    pub fn is_thread_running(&self, thread_id: &str) -> bool {
        self.lock().values().any(|run| run.thread_id == thread_id)
    }
}

/// Keeps a run registered for as long as it lives.
pub struct RunGuard {
    registry: RunRegistry,
    run_id: String,
}

impl Drop for RunGuard {
    fn drop(&mut self) {
        self.registry.lock().remove(&self.run_id);
    }
}

/// Resolves when the run is asked to stop.
#[derive(Debug)]
pub struct CancelSignal(oneshot::Receiver<()>);

impl CancelSignal {
    /// Never resolves unless the run is cancelled: a dropped sender means the
    /// registry forgot the run, which is not a request to stop it.
    pub async fn cancelled(&mut self) {
        if (&mut self.0).await.is_err() {
            futures::future::pending::<()>().await;
        }
    }

    /// A signal nobody can fire, for tests that do not cancel.
    #[cfg(test)]
    pub fn never() -> Self {
        Self(oneshot::channel().1)
    }
}

#[cfg(test)]
mod tests {
    use futures::future::{select, Either};

    use super::*;

    fn is_cancelled(signal: &mut CancelSignal) -> bool {
        tauri::async_runtime::block_on(async {
            let cancelled = std::pin::pin!(signal.cancelled());
            matches!(
                select(cancelled, futures::future::ready(())).await,
                Either::Left(_)
            )
        })
    }

    #[test]
    fn a_thread_runs_one_run_at_a_time() {
        let registry = RunRegistry::default();
        let _first = registry.register("r1", "t1").unwrap();

        assert!(registry.register("r2", "t1").is_err());
        assert!(registry.register("r3", "t2").is_ok());
        assert!(registry.is_thread_running("t1"));
    }

    #[test]
    fn dropping_the_guard_frees_the_thread() {
        let registry = RunRegistry::default();
        let (guard, _signal) = registry.register("r1", "t1").unwrap();

        drop(guard);

        assert!(!registry.is_thread_running("t1"));
        assert!(registry.register("r2", "t1").is_ok());
    }

    #[test]
    fn cancel_resolves_the_signal_of_that_run_only() {
        let registry = RunRegistry::default();
        let (_g1, mut signal1) = registry.register("r1", "t1").unwrap();
        let (_g2, mut signal2) = registry.register("r2", "t2").unwrap();

        registry.cancel("r1");

        assert!(is_cancelled(&mut signal1));
        assert!(!is_cancelled(&mut signal2));
    }

    #[test]
    fn cancelling_is_idempotent_and_forgives_unknown_runs() {
        let registry = RunRegistry::default();
        let (guard, mut signal) = registry.register("r1", "t1").unwrap();

        registry.cancel("r1");
        registry.cancel("r1");
        registry.cancel("unknown");
        assert!(is_cancelled(&mut signal));

        drop(guard);
        registry.cancel("r1");
    }

    #[test]
    fn a_forgotten_run_is_not_a_cancelled_one() {
        let registry = RunRegistry::default();
        let (guard, mut signal) = registry.register("r1", "t1").unwrap();

        drop(guard);
        registry.cancel("r1");

        assert!(!is_cancelled(&mut signal));
    }
}
