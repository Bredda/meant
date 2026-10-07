use rig::client::AgentClientExt;
use rig::providers::{anthropic, openai};

use crate::ai::agent::runtime::AgentError;
use crate::ai::tools::echo::Echo;
use crate::vault::secrets::ProviderId;
use crate::vault::SecretStore;

const PREAMBLE: &str = "You are a helpful assistant. Answer clearly and concisely.";

/// The model each provider runs, until model selection exists (roadmap axis 4).
pub fn model_id(provider: ProviderId) -> &'static str {
    match provider {
        ProviderId::Anthropic => anthropic::completion::CLAUDE_SONNET_4_6,
        ProviderId::OpenAi => openai::completion::GPT_5_1,
    }
}

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
    let key = api_key(provider, vault)?;

    let agent = match provider {
        ProviderId::Anthropic => {
            let client =
                anthropic::Client::new(&key).map_err(|e| AgentError::Provider(e.to_string()))?;
            client
                .agent(model_id(provider))
                .preamble(PREAMBLE)
                .default_max_turns(5)
                .tool(Echo)
                .build()
        }
        ProviderId::OpenAi => {
            let client =
                openai::Client::new(&key).map_err(|e| AgentError::Provider(e.to_string()))?;
            client
                .agent(model_id(provider))
                .preamble(PREAMBLE)
                .default_max_turns(5)
                .tool(Echo)
                .build()
        }
    };

    Ok(agent)
}

fn api_key<S: SecretStore>(provider: ProviderId, vault: &S) -> Result<String, AgentError> {
    vault
        .get_secret(provider.secret_key())
        .map_err(|e| AgentError::Provider(e.to_string()))?
        .ok_or_else(|| {
            AgentError::Provider(format!(
                "No {} API key configured. Add one in Settings.",
                provider.label()
            ))
        })
}

/// Cap on the title call, in tokens. A title is a few words; the margin is for
/// models that spend part of the budget reasoning before they answer.
const TITLE_MAX_TOKENS: u64 = 120;

/// Builds the one-shot agent that names a thread: no tools, a short answer.
/// Not cached (it runs once per thread), so it reads the key itself like
/// [`build_agent`].
pub fn build_title_agent<S: SecretStore>(
    provider: ProviderId,
    vault: &S,
    preamble: &str,
) -> Result<rig::agent::Agent, AgentError> {
    let key = api_key(provider, vault)?;

    let agent = match provider {
        ProviderId::Anthropic => {
            let client =
                anthropic::Client::new(&key).map_err(|e| AgentError::Provider(e.to_string()))?;
            client
                .agent(model_id(provider))
                .preamble(preamble)
                .max_tokens(TITLE_MAX_TOKENS)
                .build()
        }
        ProviderId::OpenAi => {
            let client =
                openai::Client::new(&key).map_err(|e| AgentError::Provider(e.to_string()))?;
            client
                .agent(model_id(provider))
                .preamble(preamble)
                .max_tokens(TITLE_MAX_TOKENS)
                .build()
        }
    };

    Ok(agent)
}
