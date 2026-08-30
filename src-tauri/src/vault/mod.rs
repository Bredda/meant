pub mod keyring_store;
pub mod error;
#[cfg(test)]
mod mock;   

use crate::vault::error::VaultError;

pub trait SecretStore {
    fn get_secret(&self, key: &str) -> Result<Option<String>, VaultError>;
    fn set_secret(&self, key: &str, value: &str) -> Result<(), VaultError>;
    fn delete_secret(&self, key: &str) -> Result<(), VaultError>;
}

#[cfg(test)]
mod tests {
    use super::mock::InMemoryStore;
    use super::SecretStore;

    #[test]
    fn get_secret_returns_none_when_absent() {
        let store = InMemoryStore::new();

        let result = store.get_secret("openai_api_key").unwrap();

        assert_eq!(result, None);
    }

    #[test]
    fn set_then_get_roundtrip() {
        let store = InMemoryStore::new();

        store.set_secret("openai_api_key", "sk-test-123").unwrap();
        let result = store.get_secret("openai_api_key").unwrap();

        assert_eq!(result, Some("sk-test-123".to_string()));
    }

    #[test]
    fn set_overwrites_existing_value() {
        let store = InMemoryStore::new();

        store.set_secret("openai_api_key", "old-value").unwrap();
        store.set_secret("openai_api_key", "new-value").unwrap();
        let result = store.get_secret("openai_api_key").unwrap();

        assert_eq!(result, Some("new-value".to_string()));
    }

    #[test]
    fn delete_removes_secret() {
        let store = InMemoryStore::new();
        store.set_secret("openai_api_key", "sk-test-123").unwrap();

        store.delete_secret("openai_api_key").unwrap();
        let result = store.get_secret("openai_api_key").unwrap();

        assert_eq!(result, None);
    }

    #[test]
    fn delete_is_idempotent_when_key_absent() {
        let store = InMemoryStore::new();

        // Deleting a key that was never set should not error.
        let result = store.delete_secret("never_set_key");

        assert!(result.is_ok());
    }

    #[test]
    fn secrets_are_scoped_by_key() {
        let store = InMemoryStore::new();
        store.set_secret("openai_api_key", "sk-openai").unwrap();
        store.set_secret("anthropic_api_key", "sk-anthropic").unwrap();

        assert_eq!(store.get_secret("openai_api_key").unwrap(), Some("sk-openai".to_string()));
        assert_eq!(store.get_secret("anthropic_api_key").unwrap(), Some("sk-anthropic".to_string()));
    }
}