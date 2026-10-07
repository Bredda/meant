#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("database lock poisoned by an earlier panic")]
    Poisoned,
}
