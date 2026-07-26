CREATE TABLE sunday_review_session (
    id TEXT PRIMARY KEY,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    timezone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
        'not_started', 'in_progress', 'ready_for_packet', 'completed', 'abandoned', 'archived'
    )),
    current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 14),
    task_retrieved_at TEXT NOT NULL,
    restarted_from_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    abandoned_at TEXT,
    archived_at TEXT,
    FOREIGN KEY (restarted_from_id) REFERENCES sunday_review_session(id)
);

CREATE UNIQUE INDEX idx_sunday_review_one_active_week
ON sunday_review_session(week_start, week_end, timezone)
WHERE status IN ('not_started', 'in_progress', 'ready_for_packet');

CREATE INDEX idx_sunday_review_session_week
ON sunday_review_session(week_start DESC, week_end DESC, created_at DESC);

CREATE TABLE sunday_review_task_reference (
    session_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    PRIMARY KEY (session_id, item_id),
    FOREIGN KEY (session_id) REFERENCES sunday_review_session(id) ON DELETE CASCADE
);

CREATE TABLE sunday_review_answer (
    session_id TEXT NOT NULL,
    step INTEGER NOT NULL CHECK (step BETWEEN 1 AND 13),
    field_key TEXT NOT NULL,
    response_kind TEXT NOT NULL CHECK (response_kind IN (
        'answered', 'none', 'not_applicable', 'unknown', 'skipped', 'deferred'
    )),
    input_kind TEXT NOT NULL DEFAULT 'typed' CHECK (input_kind IN ('typed', 'pasted', 'uploaded_summary')),
    raw_input TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, step, field_key),
    FOREIGN KEY (session_id) REFERENCES sunday_review_session(id) ON DELETE CASCADE
);

CREATE TABLE sunday_review_step_state (
    session_id TEXT NOT NULL,
    step INTEGER NOT NULL CHECK (step BETWEEN 1 AND 13),
    state TEXT NOT NULL CHECK (state IN ('completed', 'skipped')),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, step),
    FOREIGN KEY (session_id) REFERENCES sunday_review_session(id) ON DELETE CASCADE
);
