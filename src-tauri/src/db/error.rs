use std::path::PathBuf;

// Wired into ThreadRepository by the typed-errors refactor (fixes.md R2).
#[allow(dead_code)]
#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("failed to read {path}: {source}")]
    Connect {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
}
