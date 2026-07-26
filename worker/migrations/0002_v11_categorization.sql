PRAGMA foreign_keys = OFF;

DROP TRIGGER IF EXISTS set_raw_capture_item;
DROP INDEX IF EXISTS idx_item_kind_status;

CREATE TABLE item_v11 (
    id TEXT PRIMARY KEY,
    capture_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    primary_category TEXT CHECK (primary_category IN (
        'Procurement',
        'Admin & Finance',
        'Communication & Follow-Up',
        'Scheduling & Coordination',
        'Project Work',
        'Problems to Solve',
        'Research / Figure Out',
        'General Task'
    )),
    domain TEXT CHECK (domain IN ('Business', 'Personal', 'Home', 'Health', 'Family', 'Learning')),
    requested_by TEXT CHECK (requested_by IN ('Self', 'Dan', 'Customer', 'Team', 'Vendor', 'System', 'Other')),
    project TEXT,
    status TEXT NOT NULL DEFAULT 'Inbox' CHECK (status IN ('Inbox', 'Open', 'Waiting', 'Done', 'Archived')),
    due_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (capture_id) REFERENCES raw_capture(id) ON DELETE CASCADE,
    CHECK (primary_category IS NOT NULL OR status IN ('Inbox', 'Archived'))
);

INSERT INTO item_v11 (
    id, capture_id, title, primary_category, status, due_at, created_at, updated_at
)
SELECT
    id,
    capture_id,
    title,
    CASE kind
        WHEN 'task' THEN 'General Task'
        WHEN 'decision' THEN 'Problems to Solve'
        WHEN 'waiting_on' THEN 'Communication & Follow-Up'
        WHEN 'reference' THEN 'Research / Figure Out'
        WHEN 'event' THEN 'Scheduling & Coordination'
    END,
    CASE status WHEN 'completed' THEN 'Done' ELSE 'Open' END,
    due_date,
    created_at,
    updated_at
FROM item;

DROP TABLE item;
ALTER TABLE item_v11 RENAME TO item;

CREATE TABLE item_flag (
    item_id TEXT NOT NULL,
    flag TEXT NOT NULL CHECK (flag IN ('Urgent', 'Time-Sensitive', 'Waiting On', 'Quick Task', 'Deep Work')),
    PRIMARY KEY (item_id, flag),
    FOREIGN KEY (item_id) REFERENCES item(id) ON DELETE CASCADE
);

INSERT INTO item (id, capture_id, title, status, created_at, updated_at)
SELECT
    'inbox-' || raw_capture.id,
    raw_capture.id,
    substr(raw_capture.raw_text, 1, 120),
    'Inbox',
    raw_capture.created_at,
    raw_capture.created_at
FROM raw_capture
WHERE NOT EXISTS (SELECT 1 FROM item WHERE item.capture_id = raw_capture.id);

UPDATE raw_capture
SET created_item_id = (SELECT item.id FROM item WHERE item.capture_id = raw_capture.id),
    processed_at = CASE
        WHEN (SELECT item.status FROM item WHERE item.capture_id = raw_capture.id) = 'Inbox' THEN NULL
        ELSE COALESCE(processed_at, created_at)
    END;

CREATE INDEX idx_item_category_status ON item(primary_category, status);
CREATE INDEX idx_item_domain_status ON item(domain, status);
CREATE INDEX idx_item_requested_by_status ON item(requested_by, status);
CREATE INDEX idx_item_project ON item(project);
CREATE INDEX idx_item_due_at ON item(due_at);
CREATE INDEX idx_item_flag_flag ON item_flag(flag, item_id);

PRAGMA foreign_keys = ON;
