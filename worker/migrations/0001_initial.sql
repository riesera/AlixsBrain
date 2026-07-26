PRAGMA foreign_keys = ON;

CREATE TABLE raw_capture (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    source TEXT NOT NULL,
    source_update_id TEXT NOT NULL,
    source_message_id TEXT,
    source_user_id TEXT,
    source_chat_id TEXT,
    source_timestamp TEXT,
    raw_text TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    processed_at TEXT,
    created_item_id TEXT,
    UNIQUE (source, source_update_id)
);

CREATE INDEX idx_raw_capture_created_at ON raw_capture(created_at DESC);
CREATE INDEX idx_raw_capture_unprocessed ON raw_capture(processed_at, created_at DESC);

CREATE TABLE item (
    id TEXT PRIMARY KEY,
    capture_id TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('task', 'decision', 'waiting_on', 'reference', 'event')),
    title TEXT NOT NULL,
    body TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
    priority TEXT,
    due_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (capture_id) REFERENCES raw_capture(id)
);

CREATE INDEX idx_item_kind_status ON item(kind, status);

CREATE TRIGGER set_raw_capture_item AFTER INSERT ON item BEGIN
    UPDATE raw_capture SET created_item_id = NEW.id, processed_at = NEW.created_at
    WHERE id = NEW.capture_id;
END;
