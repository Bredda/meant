use std::fs;
use std::path::PathBuf;
use serde::{de::DeserializeOwned, Serialize};
use crate::storage::{codec::Codec, error::StoreError};

pub struct AtomicFileStore<T, C: Codec> {
    path: PathBuf,
    _codec: std::marker::PhantomData<C>,
    _value: std::marker::PhantomData<T>,
}

impl<T, C> AtomicFileStore<T, C>
where
    T: Serialize + DeserializeOwned,
    C: Codec,
{
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            _codec: std::marker::PhantomData,
            _value: std::marker::PhantomData,
        }
    }

    /// Returns Ok(None) if the file doesn't exist yet — this is how the
    /// caller detects "first run" without treating it as an error.
    pub fn load(&self) -> Result<Option<T>, StoreError> {
        if !self.path.exists() {
            return Ok(None);
        }
        let raw = fs::read_to_string(&self.path).map_err(|source| StoreError::Read {
            path: self.path.clone(),
            source,
        })?;
        let value = C::decode(&raw, &self.path)?;
        Ok(Some(value))
    }

    pub fn save(&self, value: &T) -> Result<(), StoreError> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|source| StoreError::Write {
                path: self.path.clone(),
                source,
            })?;
        }

        let encoded = C::encode(value)?;

        // Atomic write: write to a temp file, then rename.
        // If the app crashes mid-write, the real config file is untouched —
        // you either have the old valid file, or a stray .tmp file, never
        // a half-written config.
        let tmp_path = self.path.with_extension("tmp");
        fs::write(&tmp_path, encoded).map_err(|source| StoreError::Write {
            path: tmp_path.clone(),
            source,
        })?;
        fs::rename(&tmp_path, &self.path).map_err(|source| StoreError::Write {
            path: self.path.clone(),
            source,
        })?;

        Ok(())
    }
}

impl<T, C> AtomicFileStore<T, C>
where
    T: Serialize + DeserializeOwned + Default,
    C: Codec,
{
    pub fn update<F>(&self, mutate: F) -> Result<T, StoreError>
    where
        F: FnOnce(&mut T),
    {
        let mut value = self.load()?.unwrap_or_default();
        mutate(&mut value);
        self.save(&value)?;
        Ok(value)
    }
}

/**
 * UNIT TESTS
 */

#[cfg(test)]
mod tests {
    use crate::config::AppConfig;
    use crate::storage::codec::TomlCodec;
    use super::*;
    
    #[test]
    fn load_returns_none_when_file_does_not_exist() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        let store: AtomicFileStore<AppConfig, TomlCodec> = AtomicFileStore::new(path);

        let result = store.load().unwrap();

        assert_eq!(result, None);
    }
    
    #[test]
    fn save_then_load_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let store: AtomicFileStore<AppConfig, TomlCodec> =
            AtomicFileStore::new(dir.path().join("config.toml"));

        let config = AppConfig { theme: "dark".to_string(), username: "toto".to_string() };
        store.save(&config).unwrap();

        let loaded = store.load().unwrap();

        assert_eq!(loaded, Some(config));
    }

    #[test]
    fn load_returns_error_on_corrupted_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        std::fs::write(&path, "this is not valid toml {{{").unwrap();

        let store: AtomicFileStore<AppConfig, TomlCodec> = AtomicFileStore::new(path);

        let result = store.load();

        assert!(matches!(result, Err(StoreError::Decode { .. })));
    }

    #[test]
    fn update_creates_file_with_default_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let store: AtomicFileStore<AppConfig, TomlCodec> =
            AtomicFileStore::new(dir.path().join("config.toml"));

        let updated = store.update(|config| {
            config.theme = "light".to_string();
        }).unwrap();

        assert_eq!(updated.theme, "light");
    }
}