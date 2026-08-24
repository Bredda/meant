use crate::{
    ai::agent::react::ReActAgent, db::ThreadRepository, runs::service::RunService,
    
};


pub struct AppState {
    pub threads: ThreadRepository,
    pub agent: RunService<ReActAgent>,
}