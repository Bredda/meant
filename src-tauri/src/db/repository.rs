use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use rusqlite::{params, Connection, OptionalExtension};

use crate::db::{
    error::DbError,
    migrations,
    models::{NewMessage, NewRun, StoredThreadMessage, Thread},
};

pub struct ThreadRepository {
    connection: Mutex<Connection>,
}

impl ThreadRepository {
    pub fn new(path: &Path) -> Result<Self, DbError> {
        let connection = Connection::open(path.join("meant.db"))?;
        Self::from_connection(connection)
    }

    /// Prepares any connection (a file, or an in-memory database in tests).
    pub fn from_connection(mut connection: Connection) -> Result<Self, DbError> {
        // Per-connection setting, not part of the schema.
        connection.pragma_update(None, "foreign_keys", true)?;
        migrations::migrate(&mut connection)?;

        // A run still marked running belongs to a previous process that
        // stopped mid-run (crash, forced quit).
        connection.execute(
            "UPDATE runs SET status = 'failed', error = 'Interrupted', ended_at = ?1
             WHERE status = 'running'",
            params![chrono::Utc::now().timestamp()],
        )?;

        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    fn lock(&self) -> Result<MutexGuard<'_, Connection>, DbError> {
        self.connection.lock().map_err(|_| DbError::Poisoned)
    }

    pub fn create_thread(&self) -> Result<Thread, DbError> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();
        let title = "New thread".to_string();

        self.lock()?.execute(
            r#"
                INSERT INTO threads (
                    id,
                    title,
                    created_at,
                    updated_at
                )
                VALUES (?1, ?2, ?3, ?4)
                "#,
            params![id, title, now, now],
        )?;

        Ok(Thread {
            id,
            title,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn get_thread(&self, thread_id: &str) -> Result<Option<Thread>, DbError> {
        let connection = self.lock()?;

        let mut statement = connection.prepare(
            r#"
                SELECT
                    id,
                    title,
                    created_at,
                    updated_at
                FROM threads
                WHERE id = ?1
                "#,
        )?;

        statement
            .query_row(params![thread_id], |row| {
                Ok(Thread {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .optional()
            .map_err(DbError::from)
    }

    /// Records a run as `running` before the model is called, so a failure
    /// (or a crash) leaves a trace.
    pub fn start_run(&self, run: &NewRun) -> Result<(), DbError> {
        self.lock()?.execute(
            r#"
                INSERT INTO runs (id, thread_id, provider, model, status, started_at)
                VALUES (?1, ?2, ?3, ?4, 'running', ?5)
                "#,
            params![
                run.id,
                run.thread_id,
                run.provider,
                run.model,
                chrono::Utc::now().timestamp()
            ],
        )?;
        Ok(())
    }

    pub fn finish_run(
        &self,
        run_id: &str,
        status: &str,
        error: Option<&str>,
    ) -> Result<(), DbError> {
        self.lock()?.execute(
            "UPDATE runs SET status = ?2, error = ?3, ended_at = ?4 WHERE id = ?1",
            params![run_id, status, error, chrono::Utc::now().timestamp()],
        )?;
        Ok(())
    }

    pub fn add_message(
        &self,
        thread_id: &str,
        run_id: Option<&str>,
        message: &NewMessage,
    ) -> Result<StoredThreadMessage, DbError> {
        let mut stored = self.append_messages(thread_id, run_id, std::slice::from_ref(message))?;
        stored
            .pop()
            .ok_or(DbError::Sqlite(rusqlite::Error::QueryReturnedNoRows))
    }

    /// Inserts `messages` after the thread's last one, all or nothing: a run's
    /// output is never left half-written.
    pub fn append_messages(
        &self,
        thread_id: &str,
        run_id: Option<&str>,
        messages: &[NewMessage],
    ) -> Result<Vec<StoredThreadMessage>, DbError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        let now = chrono::Utc::now().timestamp();

        let first_position: i64 = transaction.query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM messages WHERE thread_id = ?1",
            params![thread_id],
            |row| row.get(0),
        )?;

        let mut stored = Vec::with_capacity(messages.len());
        for (position, message) in (first_position..).zip(messages) {
            transaction.execute(
                r#"
                    INSERT INTO messages (
                        id,
                        thread_id,
                        run_id,
                        role,
                        content,
                        tool_call_id,
                        tool_name,
                        position,
                        created_at
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                    "#,
                params![
                    message.id,
                    thread_id,
                    run_id,
                    message.role,
                    message.content,
                    message.tool_call_id,
                    message.tool_name,
                    position,
                    now
                ],
            )?;

            stored.push(StoredThreadMessage {
                id: message.id.clone(),
                thread_id: thread_id.to_string(),
                run_id: run_id.map(str::to_string),
                role: message.role.to_string(),
                content: message.content.clone(),
                tool_call_id: message.tool_call_id.clone(),
                tool_name: message.tool_name.clone(),
                position,
                created_at: now,
            });
        }

        transaction.execute(
            "UPDATE threads SET updated_at = ?1 WHERE id = ?2",
            params![now, thread_id],
        )?;
        transaction.commit()?;

        Ok(stored)
    }

    pub fn get_messages(&self, thread_id: &str) -> Result<Vec<StoredThreadMessage>, DbError> {
        let connection = self.lock()?;

        let mut statement = connection.prepare(
            r#"
                SELECT
                    id,
                    thread_id,
                    run_id,
                    role,
                    content,
                    tool_call_id,
                    tool_name,
                    position,
                    created_at
                FROM messages
                WHERE thread_id = ?1
                ORDER BY position ASC
                "#,
        )?;

        let rows = statement.query_map(params![thread_id], |row| {
            Ok(StoredThreadMessage {
                id: row.get(0)?,
                thread_id: row.get(1)?,
                run_id: row.get(2)?,
                role: row.get(3)?,
                content: row.get(4)?,
                tool_call_id: row.get(5)?,
                tool_name: row.get(6)?,
                position: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;

        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn list_threads(&self) -> Result<Vec<Thread>, DbError> {
        let connection = self.lock()?;

        let mut statement = connection.prepare(
            r#"
                SELECT
                    id,
                    title,
                    created_at,
                    updated_at
                FROM threads
                ORDER BY updated_at DESC
                "#,
        )?;

        let rows = statement.query_map([], |row| {
            Ok(Thread {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;

        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    #[cfg(test)]
    fn run_status(&self, run_id: &str) -> (String, Option<String>) {
        self.lock()
            .unwrap()
            .query_row(
                "SELECT status, error FROM runs WHERE id = ?1",
                params![run_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repository() -> ThreadRepository {
        ThreadRepository::from_connection(Connection::open_in_memory().unwrap()).unwrap()
    }

    fn text(id: &str, role: &'static str) -> NewMessage {
        NewMessage {
            id: id.into(),
            role,
            content: id.into(),
            tool_call_id: None,
            tool_name: None,
        }
    }

    fn run(id: &str, thread_id: &str) -> NewRun {
        NewRun {
            id: id.into(),
            thread_id: thread_id.into(),
            provider: "anthropic".into(),
            model: "model".into(),
        }
    }

    #[test]
    fn appended_messages_follow_existing_positions() {
        let repo = repository();
        let thread = repo.create_thread().unwrap();
        repo.start_run(&run("r1", &thread.id)).unwrap();
        repo.add_message(&thread.id, Some("r1"), &text("u1", "user"))
            .unwrap();

        repo.append_messages(
            &thread.id,
            Some("r1"),
            &[text("a1", "assistant"), text("a2", "assistant")],
        )
        .unwrap();

        let messages = repo.get_messages(&thread.id).unwrap();
        let summary: Vec<_> = messages
            .iter()
            .map(|m| (m.id.as_str(), m.position, m.run_id.as_deref()))
            .collect();
        assert_eq!(
            summary,
            [
                ("u1", 0, Some("r1")),
                ("a1", 1, Some("r1")),
                ("a2", 2, Some("r1"))
            ]
        );
    }

    #[test]
    fn a_failed_append_writes_nothing() {
        let repo = repository();
        let thread = repo.create_thread().unwrap();

        // Same id twice: the second insert violates the primary key.
        let result = repo.append_messages(
            &thread.id,
            None,
            &[text("a1", "assistant"), text("a1", "assistant")],
        );

        assert!(result.is_err());
        assert!(repo.get_messages(&thread.id).unwrap().is_empty());
    }

    #[test]
    fn a_run_records_its_outcome() {
        let repo = repository();
        let thread = repo.create_thread().unwrap();
        repo.start_run(&run("r1", &thread.id)).unwrap();
        assert_eq!(repo.run_status("r1").0, "running");

        repo.finish_run("r1", "failed", Some("Provider error: 401"))
            .unwrap();

        assert_eq!(
            repo.run_status("r1"),
            ("failed".into(), Some("Provider error: 401".into()))
        );
    }
}
