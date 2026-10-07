-- One row per agent run, written as `running` before the model is called and
-- closed as `completed` or `failed`. Messages point to the run that produced
-- them (NULL for rows written before runs existed).
CREATE TABLE runs (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER
);

CREATE INDEX idx_runs_thread ON runs(thread_id, started_at);

ALTER TABLE messages ADD COLUMN run_id TEXT REFERENCES runs(id) ON DELETE SET NULL;
