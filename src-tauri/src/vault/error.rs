#[derive(Debug, thiserror::Error)]
pub enum VaultError {
    #[error("OS vault is not accessible: {0}")]
    Unavailable(String),

    #[error("invalid secret data for key: {0}")]
    InvalidData(String),

    #[error("this does not look like a valid {0} API key")]
    InvalidFormat(String),

    #[error("at least one AI provider must stay configured")]
    LastProvider,

    #[error("unexpected vault error: {0}")]
    Unknown(String),
}

impl From<keyring::Error> for VaultError {
    fn from(err: keyring::Error) -> Self {
        match err {
            keyring::Error::PlatformFailure(source) | keyring::Error::NoStorageAccess(source) => {
                VaultError::Unavailable(source.to_string())
            }
            keyring::Error::BadEncoding(_)
            | keyring::Error::TooLong(_, _)
            | keyring::Error::Invalid(_, _)
            | keyring::Error::Ambiguous(_) => VaultError::InvalidData(err.to_string()),
            keyring::Error::NoEntry => {
                // Should never reach here: NoEntry is intercepted before this
                // conversion runs, in get_secret/delete_secret below.
                VaultError::Unknown("unexpected NoEntry reached error mapping".into())
            }
            _ => VaultError::Unknown(err.to_string()),
        }
    }
}

impl serde::Serialize for VaultError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}