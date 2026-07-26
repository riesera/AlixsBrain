import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { ALL_TASK_STATUSES, readCanonicalTasks } from "../src/task-reader";
import type { ItemStatus } from "../src/types";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });

async function insertTask(status: ItemStatus, rawText: string): Promise<string> {
  const captureId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO raw_capture
      (id, created_at, source, source_update_id, source_message_id, source_user_id,
       source_chat_id, raw_text, metadata_json)
      VALUES (?, ?, 'telegram', ?, 'secret-message', 'secret-user', 'secret-chat', ?, ?)`
    ).bind(captureId, now, crypto.randomUUID(), rawText, JSON.stringify({ token: "secret-token" })),
    env.DB.prepare(`INSERT INTO item
      (id, capture_id, title, primary_category, domain, requested_by, project, status,
       due_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, ?, ?)`
    ).bind(itemId, captureId, `${status} title`, status === "Inbox" ? null : "General Task", status, now, now)
  ]);
  return itemId;
}

describe("canonical task reader", () => {
  it("returns only Inbox, Open, and Waiting by default", async () => {
    const ids = new Map<ItemStatus, string>();
    for (const status of ALL_TASK_STATUSES) ids.set(status, await insertTask(status, `${status} raw text`));

    const tasks = await readCanonicalTasks(env.DB);
    const included = tasks.filter(task => [...ids.values()].includes(task.id));

    expect(included.map(task => task.status).sort()).toEqual(["Inbox", "Open", "Waiting"]);
    expect(included.some(task => task.id === ids.get("Done"))).toBe(false);
    expect(included.some(task => task.id === ids.get("Archived"))).toBe(false);
  });

  it("preserves raw text and nulls and exposes no capture metadata or Telegram identity", async () => {
    const rawText = "  Keep leading space\r\nKeep trailing space  \n";
    const id = await insertTask("Open", rawText);
    const task = (await readCanonicalTasks(env.DB)).find(candidate => candidate.id === id);

    expect(task).toBeDefined();
    expect(task?.raw_text).toBe(rawText);
    expect(task).toMatchObject({ domain: null, requested_by: null, project: null, due_at: null, flags: [] });
    expect(Object.keys(task ?? {}).sort()).toEqual([
      "capture_id", "created_at", "domain", "due_at", "flags", "id", "primary_category",
      "project", "raw_text", "requested_by", "source", "status", "title", "updated_at"
    ]);
    expect(JSON.stringify(task)).not.toContain("secret-user");
    expect(JSON.stringify(task)).not.toContain("secret-chat");
    expect(JSON.stringify(task)).not.toContain("secret-message");
    expect(JSON.stringify(task)).not.toContain("secret-token");
  });

  it("can explicitly read Done and Archived for existing dashboard compatibility", async () => {
    const doneId = await insertTask("Done", "done");
    const archivedId = await insertTask("Archived", "archived");
    const tasks = await readCanonicalTasks(env.DB, { statuses: ALL_TASK_STATUSES });

    expect(tasks.some(task => task.id === doneId && task.status === "Done")).toBe(true);
    expect(tasks.some(task => task.id === archivedId && task.status === "Archived")).toBe(true);
  });
});
