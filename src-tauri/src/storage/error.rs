use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("failed to read {path}: {source}")]
    Read {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("failed to write {path}: {source}")]
    Write {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("failed to parse {path} as TOML: {source}")]
    Decode {
        path: PathBuf,
        #[source]
        source: toml::de::Error,
    },

    #[error("failed to serialize value for {path}: {source}")]
    Encode {
        path: PathBuf,
        #[source]
        source: toml::ser::Error,
    },
}

impl serde::Serialize for StoreError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
