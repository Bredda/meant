use keyring::Entry;
use super::{SecretStore};

use crate::vault::error::VaultError;

pub struct KeyringStore {
    service: String,
}

impl KeyringStore {
    pub fn new(service: impl Into<String>) -> Self {
        Self { service: service.into() }
    }

    fn entry(&self, key: &str) -> Result<Entry, VaultError> {
        Entry::new(&self.service, key).map_err(VaultError::from)
    }
}

impl SecretStore for KeyringStore {
    fn get_secret(&self, key: &str) -> Result<Option<String>, VaultError> {
        match self.entry(key)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None), // intercepted BEFORE VaultError::from
            Err(err) => Err(VaultError::from(err)),
        }
    }

    fn set_secret(&self, key: &str, value: &str) -> Result<(), VaultError> {
        self.entry(key)?.set_password(value).map_err(VaultError::from)
    }

    fn delete_secret(&self, key: &str) -> Result<(), VaultError> {
        match self.entry(key)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()), // idempotent
            Err(err) => Err(VaultError::from(err)),
        }
    }
}


/**
 * TESTS
 */

 #[cfg(test)]
mod tests {
use std::collections::HashMap;
use std::sync::Mutex;

use crate::vault::SecretStore;
use crate::vault::error::VaultError;


}