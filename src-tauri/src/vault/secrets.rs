use serde::{Deserialize, Serialize};

/// The AI providers Meant can hold credentials for.
///
/// This enum — not a free-form string coming from the UI — defines the set of
/// entries that may ever be written into the OS vault under the app namespace.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderId {
    Anthropic,
    #[serde(rename = "openai")]
    OpenAi,
}

impl ProviderId {
    pub const ALL: [ProviderId; 2] = [ProviderId::Anthropic, ProviderId::OpenAi];

    /// Entry name under which the key is stored in the OS vault.
    pub fn secret_key(self) -> &'static str {
        match self {
            ProviderId::Anthropic => "ANTHROPIC_API_KEY",
            ProviderId::OpenAi => "OPENAI_API_KEY",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            ProviderId::Anthropic => "Anthropic",
            ProviderId::OpenAi => "OpenAI",
        }
    }

    /// Mirrors the client-side check in `src/config/providers.ts`. The UI form
    /// is a convenience, not the trust boundary, so a malformed key is rejected
    /// here as well.
    pub fn accepts(self, key: &str) -> bool {
        match self {
            ProviderId::Anthropic => key.starts_with("sk-ant-"),
            // An Anthropic key is also `sk-` prefixed, so exclude it explicitly.
            ProviderId::OpenAi => key.starts_with("sk-") && !key.starts_with("sk-ant-"),
        }
    }
}

/// Presence-only view of a provider credential. Deliberately carries no part of
/// the secret itself: the UI never receives key material.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SecretStatus {
    pub provider: ProviderId,
    pub is_set: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secret_keys_are_distinct_per_provider() {
        assert_ne!(
            ProviderId::Anthropic.secret_key(),
            ProviderId::OpenAi.secret_key()
        );
    }

    #[test]
    fn anthropic_accepts_only_its_own_prefix() {
        assert!(ProviderId::Anthropic.accepts("sk-ant-api03-abc"));
        assert!(!ProviderId::Anthropic.accepts("sk-abc"));
        assert!(!ProviderId::Anthropic.accepts(""));
    }

    #[test]
    fn openai_rejects_anthropic_keys() {
        assert!(ProviderId::OpenAi.accepts("sk-abc"));
        assert!(!ProviderId::OpenAi.accepts("sk-ant-api03-abc"));
    }

    #[test]
    fn serializes_to_the_ids_used_by_the_ui() {
        assert_eq!(
            serde_json::to_string(&ProviderId::Anthropic).unwrap(),
            r#""anthropic""#
        );
        assert_eq!(
            serde_json::to_string(&ProviderId::OpenAi).unwrap(),
            r#""openai""#
        );
    }
}
