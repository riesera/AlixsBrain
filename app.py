from datetime import datetime
from pathlib import Path
import json
import sqlite3

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "brain.db"

app = Flask(__name__, static_folder="static", template_folder="templates")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS raw_capture (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        raw_text TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        processed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS item (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        capture_id INTEGER,
        kind TEXT NOT NULL CHECK(kind IN ('task','decision','waiting_on','reference','event')),
        title TEXT NOT NULL,
        body TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT,
        due_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(capture_id) REFERENCES raw_capture(id)
    );

    CREATE INDEX IF NOT EXISTS idx_item_kind_status ON item(kind, status);
    """)
    conn.commit()
    conn.close()


init_db()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/items", methods=["GET"])
def list_items():
    kind = request.args.get("kind")
    status = request.args.get("status")
    query = "SELECT * FROM item"
    params = []
    clauses = []
    if kind:
        clauses.append("kind = ?")
        params.append(kind)
    if status:
        clauses.append("status = ?")
        params.append(status)
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY created_at DESC"

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])


@app.route("/api/captures", methods=["GET"])
def list_captures():
    conn = get_db()
    rows = conn.execute("SELECT * FROM raw_capture ORDER BY created_at DESC").fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.route("/api/items", methods=["POST"])
def create_item():
    payload = request.get_json() or {}
    raw_text = (payload.get("raw_text") or "").strip()
    title = (payload.get("title") or "").strip()
    kind = payload.get("kind") or "task"
    body = payload.get("body") or ""
    due_date = payload.get("due_date") or None
    priority = payload.get("priority") or None

    if not raw_text and not title:
        return jsonify({"error": "raw_text or title is required"}), 400

    if not title:
        title = raw_text.splitlines()[0][:120]

    created_at = datetime.utcnow().isoformat() + "Z"
    metadata = json.dumps({"source": payload.get("source", "manual")})

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO raw_capture (created_at, raw_text, metadata) VALUES (?, ?, ?)",
        (created_at, raw_text, metadata),
    )
    capture_id = cursor.lastrowid
    cursor.execute(
        "INSERT INTO item (capture_id, kind, title, body, status, priority, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (capture_id, kind, title, body, "open", priority, due_date, created_at, created_at),
    )
    item_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({"id": item_id, "capture_id": capture_id, "kind": kind, "title": title, "body": body, "status": "open", "priority": priority, "due_date": due_date, "created_at": created_at, "updated_at": created_at}), 201


@app.route("/api/items/<int:item_id>", methods=["PATCH"])
def update_item(item_id):
    payload = request.get_json() or {}
    fields = {}
    allowed = ["title", "body", "status", "kind", "priority", "due_date"]
    for key in allowed:
        if key in payload:
            fields[key] = payload[key]
    if not fields:
        return jsonify({"error": "No valid fields provided"}), 400

    fields["updated_at"] = datetime.utcnow().isoformat() + "Z"
    assignments = ", ".join([f"{k} = ?" for k in fields])
    values = list(fields.values()) + [item_id]

    conn = get_db()
    conn.execute(f"UPDATE item SET {assignments} WHERE id = ?", values)
    conn.commit()
    row = conn.execute("SELECT * FROM item WHERE id = ?", (item_id,)).fetchone()
    conn.close()

    return jsonify(dict(row))


if __name__ == "__main__":
    app.run(debug=True, port=5000)
