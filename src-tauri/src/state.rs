use std::collections::HashMap;
use std::sync::Arc;

use tauri::async_runtime::RwLock;

use crate::{
    ai::{
        agent::{react::ReActAgent, runtime::AgentError},
        provider,
    },
    config::AppConfig,
    db::ThreadRepository,
    runs::service::RunService,
    storage::{codec::TomlCodec, file_store::AtomicFileStore},
    vault::{SecretStore, keyring_store::KeyringStore, secrets::ProviderId},
};

pub struct AppState {
    pub threads: ThreadRepository,
    pub config_store: AtomicFileStore<AppConfig, TomlCodec>,
    pub vault: KeyringStore,
    /// One cached agent per provider, each built on first use rather than at
    /// startup: a fresh install has no key until setup completes, a user can
    /// hold keys for several providers at once, and a key changed from
    /// /settings has to take effect without a restart.
    agents: RwLock<HashMap<ProviderId, Arc<RunService<ReActAgent>>>>,
}

impl AppState {
    pub fn new(
        threads: ThreadRepository,
        config_store: AtomicFileStore<AppConfig, TomlCodec>,
        vault: KeyringStore,
    ) -> Self {
        Self {
            threads,
            config_store,
            vault,
            agents: RwLock::new(HashMap::new()),
        }
    }

    /// Returns the cached agent for `provider`, building it from the vault on
    /// first use.
    ///
    /// Hands back an `Arc` rather than a lock guard so a long-running turn
    /// does not keep the map locked and block other providers' lookups or
    /// [`AppState::invalidate_agent`].
    pub async fn agent(
        &self,
        provider: ProviderId,
    ) -> Result<Arc<RunService<ReActAgent>>, AgentError> {
        if let Some(agent) = self.agents.read().await.get(&provider) {
            return Ok(Arc::clone(agent));
        }

        let mut agents = self.agents.write().await;

        // Another task may have built it while we waited for the write lock.
        if let Some(agent) = agents.get(&provider) {
            return Ok(Arc::clone(agent));
        }

        let built = Arc::new(RunService::new(ReActAgent::new(provider::build_agent(
            provider,
            &self.vault,
        )?)));
        agents.insert(provider, Arc::clone(&built));

        Ok(built)
    }

    /// Picks which provider a run without an explicit choice should use.
    ///
    /// Stopgap: nothing yet lets a thread or the composer pick a provider, so
    /// this just takes the first configured one in `ProviderId::ALL` order.
    /// Once that selection exists (per-thread default, a picker, ...) this
    /// should go away in favor of the caller always knowing which provider it
    /// wants.
    pub fn default_provider(&self) -> Result<ProviderId, AgentError> {
        ProviderId::ALL
            .into_iter()
            .find(|&provider| {
                self.vault
                    .get_secret(provider.secret_key())
                    .ok()
                    .flatten()
                    .is_some()
            })
            .ok_or_else(|| {
                AgentError::Provider("No AI provider configured. Add a key in Settings.".into())
            })
    }

    /// Drops `provider`'s cached agent so its next run picks up the current
    /// credentials.
    pub async fn invalidate_agent(&self, provider: ProviderId) {
        self.agents.write().await.remove(&provider);
    }
}
