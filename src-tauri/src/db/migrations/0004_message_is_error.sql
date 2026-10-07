-- Whether a `tool_result` row records a failed tool call (error, refusal or
-- skipped call). Meaningless for the other roles, which keep the default.
ALTER TABLE messages ADD COLUMN is_error INTEGER NOT NULL DEFAULT 0;
