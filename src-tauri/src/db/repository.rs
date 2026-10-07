use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use rusqlite::{params, Connection, OptionalExtension};

use crate::db::{
    error::DbError,
    migrations,
    models::{NewMessage, NewRun, RunSummary, StoredThreadMessage, Thread},
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

    /// Creates a thread with a provisional title (`title_source = 'default'`),
    /// which a generated title may still replace.
    pub fn create_thread(&self, title: &str) -> Result<Thread, DbError> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();
        let title = title.to_string();

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

    /// Sets a title typed by the user. It does not touch `updated_at`: renaming
    /// is not activity, and the list is ordered by last activity. Returns the
    /// updated thread, `None` if it does not exist.
    pub fn rename_thread(&self, thread_id: &str, title: &str) -> Result<Option<Thread>, DbError> {
        let updated = self.lock()?.execute(
            "UPDATE threads SET title = ?2, title_source = 'manual' WHERE id = ?1",
            params![thread_id, title],
        )?;

        if updated == 0 {
            return Ok(None);
        }
        self.get_thread(thread_id)
    }

    /// Sets a generated title, unless the user has renamed the thread or it
    /// already got one in the meantime (the model call takes seconds).
    /// Returns the updated thread, `None` when the title was left alone.
    pub fn set_auto_title(&self, thread_id: &str, title: &str) -> Result<Option<Thread>, DbError> {
        let updated = self.lock()?.execute(
            "UPDATE threads SET title = ?2, title_source = 'auto'
             WHERE id = ?1 AND title_source = 'default'",
            params![thread_id, title],
        )?;

        if updated == 0 {
            return Ok(None);
        }
        self.get_thread(thread_id)
    }

    /// Whether the thread still carries its provisional title.
    pub fn has_provisional_title(&self, thread_id: &str) -> Result<bool, DbError> {
        let source: Option<String> = self
            .lock()?
            .query_row(
                "SELECT title_source FROM threads WHERE id = ?1",
                params![thread_id],
                |row| row.get(0),
            )
            .optional()?;
        Ok(source.as_deref() == Some("default"))
    }

    /// Deletes a thread; its messages and runs go with it (foreign keys).
    /// Returns whether it existed.
    pub fn delete_thread(&self, thread_id: &str) -> Result<bool, DbError> {
        let deleted = self
            .lock()?
            .execute("DELETE FROM threads WHERE id = ?1", params![thread_id])?;
        Ok(deleted > 0)
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

    /// A thread's runs, oldest first.
    pub fn list_runs(&self, thread_id: &str) -> Result<Vec<RunSummary>, DbError> {
        let connection = self.lock()?;

        let mut statement = connection.prepare(
            r#"
                SELECT id, provider, model, status, error, started_at, ended_at
                FROM runs
                WHERE thread_id = ?1
                ORDER BY started_at ASC, rowid ASC
                "#,
        )?;

        let rows = statement.query_map(params![thread_id], |row| {
            Ok(RunSummary {
                id: row.get(0)?,
                provider: row.get(1)?,
                model: row.get(2)?,
                status: row.get(3)?,
                error: row.get(4)?,
                started_at: row.get(5)?,
                ended_at: row.get(6)?,
            })
        })?;

        Ok(rows.collect::<Result<Vec<_>, _>>()?)
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
        self.write_messages(thread_id, run_id, messages, None)
    }

    /// Replaces every message after the one at `position` (the message a
    /// regenerated run answers) with `messages`, all or nothing: a failure
    /// leaves the previous answer in place. That message is handed over to
    /// `run_id`, so an earlier run that failed or was stopped on it no longer
    /// claims it (and its notice goes away with it).
    pub fn replace_messages_after(
        &self,
        thread_id: &str,
        position: i64,
        run_id: &str,
        messages: &[NewMessage],
    ) -> Result<Vec<StoredThreadMessage>, DbError> {
        self.write_messages(thread_id, Some(run_id), messages, Some(position))
    }

    fn write_messages(
        &self,
        thread_id: &str,
        run_id: Option<&str>,
        messages: &[NewMessage],
        replace_after: Option<i64>,
    ) -> Result<Vec<StoredThreadMessage>, DbError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction()?;
        let now = chrono::Utc::now().timestamp();

        if let Some(position) = replace_after {
            transaction.execute(
                "DELETE FROM messages WHERE thread_id = ?1 AND position > ?2",
                params![thread_id, position],
            )?;
            transaction.execute(
                "UPDATE messages SET run_id = ?3 WHERE thread_id = ?1 AND position = ?2",
                params![thread_id, position, run_id],
            )?;
        }

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
                        is_error,
                        position,
                        created_at
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                    "#,
                params![
                    message.id,
                    thread_id,
                    run_id,
                    message.role,
                    message.content,
                    message.tool_call_id,
                    message.tool_name,
                    message.is_error,
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
                is_error: message.is_error,
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
                    is_error,
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
                is_error: row.get(7)?,
                position: row.get(8)?,
                created_at: row.get(9)?,
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
            is_error: false,
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
        let thread = repo.create_thread("Title").unwrap();
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
    fn a_failed_tool_result_stays_flagged_once_stored() {
        let repo = repository();
        let thread = repo.create_thread("Title").unwrap();
        let tool_result = |id: &str, is_error| NewMessage {
            role: "tool_result",
            tool_call_id: Some(format!("call-{id}")),
            tool_name: Some("echo".into()),
            is_error,
            ..text(id, "tool_result")
        };

        repo.append_messages(
            &thread.id,
            None,
            &[
                text("u1", "user"),
                tool_result("ok", false),
                tool_result("bad", true),
            ],
        )
        .unwrap();

        let flags: Vec<_> = repo
            .get_messages(&thread.id)
            .unwrap()
            .iter()
            .map(|m| (m.id.clone(), m.is_error))
            .collect();
        assert_eq!(
            flags,
            [
                ("u1".to_string(), false),
                ("ok".to_string(), false),
                ("bad".to_string(), true)
            ]
        );
    }

    fn ids(repo: &ThreadRepository, thread_id: &str) -> Vec<(String, Option<String>)> {
        repo.get_messages(thread_id)
            .unwrap()
            .into_iter()
            .map(|m| (m.id, m.run_id))
            .collect()
    }

    #[test]
    fn replacing_swaps_the_answer_and_hands_the_question_to_the_new_run() {
        let repo = repository();
        let thread = repo.create_thread("Title").unwrap();
        repo.start_run(&run("r1", &thread.id)).unwrap();
        repo.start_run(&run("r2", &thread.id)).unwrap();
        repo.append_messages(
            &thread.id,
            Some("r1"),
            &[
                text("u1", "user"),
                text("a1", "assistant"),
                text("a1b", "assistant"),
            ],
        )
        .unwrap();

        let stored = repo
            .replace_messages_after(&thread.id, 0, "r2", &[text("a2", "assistant")])
            .unwrap();

        assert_eq!(stored[0].position, 1);
        assert_eq!(
            ids(&repo, &thread.id),
            [
                ("u1".to_string(), Some("r2".to_string())),
                ("a2".to_string(), Some("r2".to_string()))
            ]
        );
    }

    #[test]
    fn a_failed_replacement_keeps_the_previous_answer() {
        let repo = repository();
        let thread = repo.create_thread("Title").unwrap();
        repo.start_run(&run("r2", &thread.id)).unwrap();
        repo.append_messages(
            &thread.id,
            None,
            &[text("u1", "user"), text("a1", "assistant")],
        )
        .unwrap();

        // Same id twice: the second insert violates the primary key.
        let result = repo.replace_messages_after(
            &thread.id,
            0,
            "r2",
            &[text("a2", "assistant"), text("a2", "assistant")],
        );

        assert!(result.is_err());
        assert_eq!(
            ids(&repo, &thread.id),
            [("u1".to_string(), None), ("a1".to_string(), None)]
        );
    }

    #[test]
    fn a_failed_append_writes_nothing() {
        let repo = repository();
        let thread = repo.create_thread("Title").unwrap();

        // Same id twice: the second insert violates the primary key.
        let result = repo.append_messages(
            &thread.id,
            None,
            &[text("a1", "assistant"), text("a1", "assistant")],
        );

        assert!(result.is_err());
        assert!(repo.get_messages(&thread.id).unwrap().is_empty());
    }

    fn title_source(repo: &ThreadRepository, thread_id: &str) -> String {
        repo.lock()
            .unwrap()
            .query_row(
                "SELECT title_source FROM threads WHERE id = ?1",
                params![thread_id],
                |row| row.get(0),
            )
            .unwrap()
    }

    #[test]
    fn renaming_marks_the_title_manual_and_keeps_the_order_key() {
        let repo = repository();
        let thread = repo.create_thread("Provisional").unwrap();
        assert_eq!(title_source(&repo, &thread.id), "default");

        let renamed = repo.rename_thread(&thread.id, "Mine").unwrap().unwrap();

        assert_eq!(renamed.title, "Mine");
        assert_eq!(renamed.updated_at, thread.updated_at);
        assert_eq!(title_source(&repo, &thread.id), "manual");
        assert!(repo.rename_thread("missing", "x").unwrap().is_none());
    }

    #[test]
    fn a_generated_title_never_replaces_the_users() {
        let repo = repository();
        let untouched = repo.create_thread("Provisional").unwrap();
        let renamed = repo.create_thread("Provisional").unwrap();
        repo.rename_thread(&renamed.id, "Mine").unwrap();

        let generated = repo.set_auto_title(&untouched.id, "Generated").unwrap();

        assert_eq!(generated.unwrap().title, "Generated");
        assert!(repo
            .set_auto_title(&renamed.id, "Generated")
            .unwrap()
            .is_none());
        assert_eq!(repo.get_thread(&renamed.id).unwrap().unwrap().title, "Mine");
        // Titled once: a second generation (or a rename race) changes nothing.
        assert!(repo
            .set_auto_title(&untouched.id, "Again")
            .unwrap()
            .is_none());
        assert!(!repo.has_provisional_title(&untouched.id).unwrap());
        assert!(!repo.has_provisional_title("missing").unwrap());
    }

    #[test]
    fn deleting_a_thread_removes_its_messages_and_runs() {
        let repo = repository();
        let thread = repo.create_thread("Title").unwrap();
        let other = repo.create_thread("Other").unwrap();
        repo.start_run(&run("r1", &thread.id)).unwrap();
        repo.add_message(&thread.id, Some("r1"), &text("u1", "user"))
            .unwrap();
        repo.add_message(&other.id, None, &text("u2", "user"))
            .unwrap();

        assert!(repo.delete_thread(&thread.id).unwrap());

        assert!(repo.get_thread(&thread.id).unwrap().is_none());
        assert!(repo.get_messages(&thread.id).unwrap().is_empty());
        let runs: i64 = repo
            .lock()
            .unwrap()
            .query_row("SELECT COUNT(*) FROM runs", [], |row| row.get(0))
            .unwrap();
        assert_eq!(runs, 0);
        assert_eq!(repo.get_messages(&other.id).unwrap().len(), 1);
        assert!(!repo.delete_thread(&thread.id).unwrap());
    }

    #[test]
    fn runs_are_listed_per_thread_oldest_first() {
        let repo = repository();
        let thread = repo.create_thread("Title").unwrap();
        let other = repo.create_thread("Other").unwrap();
        repo.start_run(&run("r1", &thread.id)).unwrap();
        repo.start_run(&run("r2", &thread.id)).unwrap();
        repo.start_run(&run("r3", &other.id)).unwrap();
        repo.finish_run("r1", "failed", Some("Provider error: 401"))
            .unwrap();

        let runs = repo.list_runs(&thread.id).unwrap();

        let summary: Vec<_> = runs
            .iter()
            .map(|r| (r.id.as_str(), r.status.as_str(), r.error.as_deref()))
            .collect();
        assert_eq!(
            summary,
            [
                ("r1", "failed", Some("Provider error: 401")),
                ("r2", "running", None)
            ]
        );
        assert!(runs[0].ended_at.is_some() && runs[1].ended_at.is_none());
    }

    #[test]
    fn a_run_interrupted_by_a_crash_is_failed_on_next_start() {
        let path = tempfile::tempdir().unwrap();
        let first = ThreadRepository::new(path.path()).unwrap();
        let thread = first.create_thread("Title").unwrap();
        first.start_run(&run("r1", &thread.id)).unwrap();
        drop(first);

        let second = ThreadRepository::new(path.path()).unwrap();

        let runs = second.list_runs(&thread.id).unwrap();
        assert_eq!(runs[0].status, "failed");
        assert_eq!(runs[0].error.as_deref(), Some("Interrupted"));
    }

    #[test]
    fn a_run_records_its_outcome() {
        let repo = repository();
        let thread = repo.create_thread("Title").unwrap();
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
