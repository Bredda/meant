-- Schema that predates migrations. IF NOT EXISTS lets databases created by
-- that code (user_version 0, tables already there) pass through unchanged.
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
    tool_call_id TEXT,
    tool_name TEXT,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL,

    FOREIGN KEY (thread_id)
        REFERENCES threads(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_thread
    ON messages(thread_id, position);
