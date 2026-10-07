use serde::{ser::SerializeStruct, Serialize};

use crate::{
    ai::agent::runtime::AgentError, db::error::DbError, storage::error::StoreError,
    vault::error::VaultError,
};

/// What went wrong, as the UI needs to know it: it picks the reaction
/// (e.g. point to Settings for `provider`), the message says the details.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorKind {
    Vault,
    Config,
    Db,
    Provider,
    NotFound,
    InvalidInput,
    Internal,
}

/// The single error type returned by Tauri commands. Serialized as
/// `{ kind, message }` (see `src/lib/errors.ts`).
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error(transparent)]
    Vault(#[from] VaultError),

    #[error(transparent)]
    Config(#[from] StoreError),

    #[error(transparent)]
    Db(#[from] DbError),

    #[error(transparent)]
    Agent(#[from] AgentError),

    #[error("{0} not found")]
    NotFound(String),

    #[error("{0}")]
    InvalidInput(String),

    #[error("{0}")]
    Internal(String),
}

impl AppError {
    pub fn kind(&self) -> ErrorKind {
        match self {
            Self::Vault(VaultError::InvalidFormat(_) | VaultError::LastProvider) => {
                ErrorKind::InvalidInput
            }
            Self::Vault(_) => ErrorKind::Vault,
            Self::Config(_) => ErrorKind::Config,
            Self::Db(_) => ErrorKind::Db,
            Self::Agent(error) => error.kind(),
            Self::NotFound(_) => ErrorKind::NotFound,
            Self::InvalidInput(_) => ErrorKind::InvalidInput,
            Self::Internal(_) => ErrorKind::Internal,
        }
    }
}

impl From<tauri::Error> for AppError {
    fn from(error: tauri::Error) -> Self {
        Self::Internal(error.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        Self::Internal(error.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("kind", &self.kind())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_kind_and_message() {
        let error = AppError::NotFound("Thread t1".into());

        assert_eq!(
            serde_json::to_value(&error).unwrap(),
            serde_json::json!({ "kind": "notFound", "message": "Thread t1 not found" })
        );
    }

    #[test]
    fn user_input_vault_errors_are_invalid_input() {
        assert_eq!(
            AppError::from(VaultError::LastProvider).kind(),
            ErrorKind::InvalidInput
        );
        assert_eq!(
            AppError::from(VaultError::Unavailable("locked".into())).kind(),
            ErrorKind::Vault
        );
    }

    #[test]
    fn provider_agent_errors_keep_their_kind() {
        assert_eq!(
            AppError::from(AgentError::Provider("401".into())).kind(),
            ErrorKind::Provider
        );
    }
}
