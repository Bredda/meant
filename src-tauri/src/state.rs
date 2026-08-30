use crate::{
    ai::agent::react::ReActAgent, config::AppConfig, db::ThreadRepository, runs::service::RunService, storage::{
        codec::TomlCodec, 
        file_store::AtomicFileStore
    }, vault::keyring_store::KeyringStore
};


pub struct AppState {
    pub threads: ThreadRepository,
    pub agent: RunService<ReActAgent>,
    pub config_store: AtomicFileStore<AppConfig, TomlCodec>,
    pub vault: KeyringStore
}