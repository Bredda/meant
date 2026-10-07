use crate::storage::error::StoreError;
use serde::{de::DeserializeOwned, Serialize};
use std::path::{Path, PathBuf};

pub trait Codec {
    fn encode<T: Serialize>(value: &T) -> Result<String, StoreError>;
    fn decode<T: DeserializeOwned>(raw: &str, path: &Path) -> Result<T, StoreError>;
}

pub struct TomlCodec;

impl Codec for TomlCodec {
    fn encode<T: Serialize>(value: &T) -> Result<String, StoreError> {
        toml::to_string_pretty(value).map_err(|source| StoreError::Encode {
            path: PathBuf::new(), // voir note plus bas
            source,
        })
    }

    fn decode<T: DeserializeOwned>(raw: &str, path: &Path) -> Result<T, StoreError> {
        toml::from_str(raw).map_err(|source| StoreError::Decode {
            path: path.to_path_buf(),
            source,
        })
    }
}
