use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};

use crate::db::models::ThreadMessage;

use super::models::Thread;

pub struct ThreadRepository {
    connection: Mutex<Connection>,
}



impl ThreadRepository {
    pub fn new(path: &str) -> Result<Self, String> {
        let connection =
            Connection::open(path).map_err(|e| e.to_string())?;

        connection
            .execute_batch(
                r#"
                PRAGMA foreign_keys = ON;

                CREATE TABLE IF NOT EXISTS threads (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    thread_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,

                    FOREIGN KEY (thread_id)
                        REFERENCES threads(id)
                        ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_messages_thread
                    ON messages(thread_id, position);
                "#,
            )
            .map_err(|e| e.to_string())?;

        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    pub fn create_thread(&self) -> Result<Thread, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();

        let connection = self
            .connection
            .lock()
            .map_err(|_| "Database mutex poisoned".to_string())?;

        connection
            .execute(
                r#"
                INSERT INTO threads (
                    id,
                    title,
                    created_at,
                    updated_at
                )
                VALUES (?1, ?2, ?3, ?4)
                "#,
                params![id, "New thread", now, now],
            )
            .map_err(|e| e.to_string())?;

        Ok(Thread {
            id,
            title: "New thread".to_string(),
            created_at: now,
            updated_at: now,
        })
    }

    pub fn get_thread(
        &self,
        thread_id: &str,
    ) -> Result<Option<Thread>, String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| "Database mutex poisoned".to_string())?;

        let mut statement = connection
            .prepare(
                r#"
                SELECT
                    id,
                    title,
                    created_at,
                    updated_at
                FROM threads
                WHERE id = ?1
                "#,
            )
            .map_err(|e| e.to_string())?;

        let thread = statement
            .query_row(params![thread_id], |row| {
                Ok(Thread {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .optional()
            .map_err(|e| e.to_string())?;

        Ok(thread)
    }

    pub fn add_message(
        &self,
        thread_id: &str,
        id: &str,
        role: &str,
        content: &str,
    ) -> Result<ThreadMessage, String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| "Database mutex poisoned".to_string())?;

        let position: i64 = connection
            .query_row(
                r#"
                SELECT COALESCE(MAX(position), -1) + 1
                FROM messages
                WHERE thread_id = ?1
                "#,
                params![thread_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let now = chrono::Utc::now().timestamp();

        connection
            .execute(
                r#"
                INSERT INTO messages (
                    id,
                    thread_id,
                    role,
                    content,
                    position,
                    created_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                "#,
                params![
                    id,
                    thread_id,
                    role,
                    content,
                    position,
                    now
                ],
            )
            .map_err(|e| e.to_string())?;

        connection
            .execute(
                r#"
                UPDATE threads
                SET updated_at = ?1
                WHERE id = ?2
                "#,
                params![now, thread_id],
            )
            .map_err(|e| e.to_string())?;

        Ok(ThreadMessage {
            id: id.to_string(),
            thread_id: thread_id.to_string(),
            role: role.to_string(),
            content: content.to_string(),
            position,
            created_at: now,
        })
    }

    pub fn get_messages(
        &self,
        thread_id: &str,
    ) -> Result<Vec<ThreadMessage>, String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| "Database mutex poisoned".to_string())?;

        let mut statement = connection
            .prepare(
                r#"
                SELECT
                    id,
                    thread_id,
                    role,
                    content,
                    position,
                    created_at
                FROM messages
                WHERE thread_id = ?1
                ORDER BY position ASC
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = statement
            .query_map(params![thread_id], |row| {
                Ok(ThreadMessage {
                    id: row.get(0)?,
                    thread_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    position: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }

    pub fn list_threads(&self) -> Result<Vec<Thread>, String> {
        let conn = self
            .connection
            .lock()
            .map_err(|_| "Database mutex poisoned".to_string())?;

        let mut statement = conn
            .prepare(
                r#"
                SELECT
                    id,
                    title,
                    created_at,
                    updated_at
                FROM threads
                ORDER BY updated_at DESC
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = statement
            .query_map([], |row| {
                Ok(Thread {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }
}