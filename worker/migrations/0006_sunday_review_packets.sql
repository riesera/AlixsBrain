CREATE TABLE sunday_review_task_snapshot (
    session_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    snapshot_kind TEXT NOT NULL CHECK (snapshot_kind IN ('initial', 'backfilled')),
    task_json TEXT NOT NULL,
    PRIMARY KEY (session_id, item_id),
    FOREIGN KEY (session_id) REFERENCES sunday_review_session(id) ON DELETE CASCADE
);

CREATE TABLE sunday_review_packet (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    generated_at TEXT NOT NULL,
    task_snapshot_at TEXT,
    markdown TEXT NOT NULL,
    UNIQUE (session_id, version),
    FOREIGN KEY (session_id) REFERENCES sunday_review_session(id) ON DELETE CASCADE
);

CREATE INDEX idx_sunday_review_packet_session
ON sunday_review_packet(session_id, version DESC);
