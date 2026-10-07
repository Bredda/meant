-- Where a thread's title comes from: `default` (derived from the first
-- message, may still be replaced by a generated one), `auto` (generated) or
-- `manual` (typed by the user, never overwritten).
ALTER TABLE threads ADD COLUMN title_source TEXT NOT NULL DEFAULT 'default';

-- Threads that already carry a title the user may have chosen are left alone.
UPDATE threads SET title_source = 'manual' WHERE title <> 'New thread';
