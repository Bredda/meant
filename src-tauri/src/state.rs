use crate::{
    ai::agent::AgentService,
    db::ThreadRepository,
};

pub struct AppState {
    pub agent: AgentService,
    pub threads: ThreadRepository,
}