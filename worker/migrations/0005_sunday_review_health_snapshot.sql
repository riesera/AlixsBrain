CREATE TABLE sunday_review_health_snapshot (
    session_id TEXT PRIMARY KEY,
    range_start TEXT NOT NULL,
    range_end TEXT NOT NULL,
    timezone TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sunday_review_session(id) ON DELETE CASCADE
);
