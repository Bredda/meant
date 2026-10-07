use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};

use crate::db::{error::DbError, migrations, models::StoredThreadMessage};

use super::models::Thread;

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

        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    pub fn create_thread(&self) -> Result<Thread, DbError> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();
        let title = "New thread".to_string();

        let connection = self.connection.lock().map_err(|_| DbError::Poisoned)?;

        connection.execute(
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
        let connection = self.connection.lock().map_err(|_| DbError::Poisoned)?;

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

    pub fn add_message(
        &self,
        thread_id: &str,
        id: &str,
        role: &str,
        content: &str,
        tool_call_id: Option<&str>,
        tool_name: Option<&str>,
    ) -> Result<StoredThreadMessage, DbError> {
        let connection = self.connection.lock().map_err(|_| DbError::Poisoned)?;

        let position: i64 = connection.query_row(
            r#"
                SELECT COALESCE(MAX(position), -1) + 1
                FROM messages
                WHERE thread_id = ?1
                "#,
            params![thread_id],
            |row| row.get(0),
        )?;

        let now = chrono::Utc::now().timestamp();

        connection.execute(
            r#"
                INSERT INTO messages (
                    id,
                    thread_id,
                    role,
                    content,
                    tool_call_id,
                    tool_name,
                    position,
                    created_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                "#,
            params![
                id,
                thread_id,
                role,
                content,
                tool_call_id,
                tool_name,
                position,
                now
            ],
        )?;

        connection.execute(
            r#"
                UPDATE threads
                SET updated_at = ?1
                WHERE id = ?2
                "#,
            params![now, thread_id],
        )?;

        Ok(StoredThreadMessage {
            id: id.to_string(),
            thread_id: thread_id.to_string(),
            role: role.to_string(),
            content: content.to_string(),
            tool_call_id: tool_call_id.map(str::to_string),
            tool_name: tool_name.map(str::to_string),
            position,
            created_at: now,
        })
    }

    pub fn get_messages(&self, thread_id: &str) -> Result<Vec<StoredThreadMessage>, DbError> {
        let connection = self.connection.lock().map_err(|_| DbError::Poisoned)?;

        let mut statement = connection.prepare(
            r#"
                SELECT
                    id,
                    thread_id,
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
                role: row.get(2)?,
                content: row.get(3)?,
                tool_call_id: row.get(4)?,
                tool_name: row.get(5)?,
                position: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;

        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn list_threads(&self) -> Result<Vec<Thread>, DbError> {
        let connection = self.connection.lock().map_err(|_| DbError::Poisoned)?;

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
}
