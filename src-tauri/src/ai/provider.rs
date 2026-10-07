use rig::client::AgentClientExt;
use rig::providers::{anthropic, openai};

use crate::ai::agent::runtime::AgentError;
use crate::ai::tools::echo::Echo;
use crate::vault::secrets::ProviderId;
use crate::vault::SecretStore;

const PREAMBLE: &str = "You are a helpful assistant. Answer clearly and concisely.";

/// Builds a fully-configured agent for `provider`, fetching its key from the
/// vault itself — callers never see or thread key material through.
///
/// Anthropic and OpenAI clients are different concrete types, so the two
/// branches below can't converge until `.build()` is called: each finishes
/// its own builder chain first. What they converge *to* is `rig`'s `Agent`,
/// which type-erases the completion model — so from here up, the rest of the
/// app (`ReActAgent`, the run cache) never has to know which provider backed
/// a given agent.
pub fn build_agent<S: SecretStore>(
    provider: ProviderId,
    vault: &S,
) -> Result<rig::agent::Agent, AgentError> {
    let key = vault
        .get_secret(provider.secret_key())
        .map_err(|e| AgentError::Provider(e.to_string()))?
        .ok_or_else(|| {
            AgentError::Provider(format!(
                "No {} API key configured. Add one in Settings.",
                provider.label()
            ))
        })?;

    let agent = match provider {
        ProviderId::Anthropic => {
            let client =
                anthropic::Client::new(&key).map_err(|e| AgentError::Provider(e.to_string()))?;
            client
                .agent(anthropic::completion::CLAUDE_SONNET_4_6)
                .preamble(PREAMBLE)
                .default_max_turns(5)
                .tool(Echo)
                .build()
        }
        ProviderId::OpenAi => {
            let client =
                openai::Client::new(&key).map_err(|e| AgentError::Provider(e.to_string()))?;
            client
                .agent(openai::completion::GPT_5_1)
                .preamble(PREAMBLE)
                .default_max_turns(5)
                .tool(Echo)
                .build()
        }
    };

    Ok(agent)
}
