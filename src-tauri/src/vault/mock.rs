use std::collections::HashMap;
use std::sync::Mutex;
use super::{SecretStore, VaultError};

pub struct InMemoryStore {
    data: Mutex<HashMap<String, String>>,
}

impl InMemoryStore {
    pub fn new() -> Self {
        Self { data: Mutex::new(HashMap::new()) }
    }
}

impl SecretStore for InMemoryStore {
    fn get_secret(&self, key: &str) -> Result<Option<String>, VaultError> {
        Ok(self.data.lock().unwrap().get(key).cloned())
    }
    fn set_secret(&self, key: &str, value: &str) -> Result<(), VaultError> {
        self.data.lock().unwrap().insert(key.to_string(), value.to_string());
        Ok(())
    }
    fn delete_secret(&self, key: &str) -> Result<(), VaultError> {
        self.data.lock().unwrap().remove(key);
        Ok(())
    }
}