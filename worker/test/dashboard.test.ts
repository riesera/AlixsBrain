import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

const auth = `Basic ${btoa("test-user:test-password")}`;
const request = (path: string, init: RequestInit = {}) => worker.fetch(
  new Request(`https://example.com${path}`, {
    ...init,
    headers: { authorization: auth, ...(init.headers || {}) }
  }),
  env
);

beforeEach(() => { vi.restoreAllMocks(); });
beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });

describe("dashboard authentication and API", () => {
  it("serves Tasks, Sunday Review, and Health tabs from the authenticated dashboard", async () => {
    const response = await request("/");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('data-view="tasks"');
    expect(html).toContain('data-view="review"');
    expect(html).toContain('data-view="health"');
    expect(html).toContain("Sunday Review");
  });

  it("reports authenticated database status without capture content", async () => {
    const response = await request("/api/status");
    expect(response.status).toBe(200);
    const status = await response.json<{ ok: boolean; database: Record<string, unknown> }>();
    expect(status.ok).toBe(true);
    expect(status.database).toHaveProperty("capture_count");
    expect(JSON.stringify(status)).not.toContain("raw_text");
  });

  it("challenges unauthenticated dashboard and API requests", async () => {
    const page = await worker.fetch(new Request("https://example.com/"), env);
    const api = await worker.fetch(new Request("https://example.com/api/items"), env);
    expect(page.status).toBe(401);
    expect(api.status).toBe(401);
    expect(page.headers.get("www-authenticate")).toContain("Basic");
  });

  it("rejects incorrect dashboard credentials", async () => {
    const response = await worker.fetch(new Request("https://example.com/api/items", {
      headers: { authorization: `Basic ${btoa("test-user:wrong")}` }
    }), env);
    expect(response.status).toBe(401);
  });

  it("lists unprocessed Telegram captures in the inbox", async () => {
    const captureId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO raw_capture (id, created_at, source, source_update_id, raw_text, metadata_json)
      VALUES (?, ?, 'telegram', ?, ?, '{}')
    `).bind(captureId, now, crypto.randomUUID(), "Inbox test capture").run();
    await env.DB.prepare(`INSERT INTO item (id, capture_id, title, status, created_at, updated_at)
      VALUES (?, ?, 'Inbox test capture', 'Inbox', ?, ?)`
    ).bind(itemId, captureId, now, now).run();
    const response = await request("/api/captures");
    expect(response.status).toBe(200);
    const captures = await response.json<Array<{ raw_text: string }>>();
    expect(captures.some(capture => capture.raw_text === "Inbox test capture")).toBe(true);
  });

  it("categorizes an Inbox item with independent metadata and multiple flags", async () => {
    const created = await request("/api/items", { method: "POST", body: JSON.stringify({ raw_text: "Deal with mice" }) });
    const { id } = await created.json<{ id: string }>();
    const updated = await request(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify({
      primary_category: "Problems to Solve", domain: "Home", requested_by: "Self",
      project: "House", flags: ["Urgent", "Time-Sensitive"]
    }) });
    expect(updated.status).toBe(200);
    const item = await env.DB.prepare("SELECT * FROM item WHERE id = ?").bind(id).first();
    expect(item?.primary_category).toBe("Problems to Solve");
    expect(item?.domain).toBe("Home");
    expect(item?.status).toBe("Open");
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM item_flag WHERE item_id = ?").bind(id).first("count")).toBe(2);
  });

  it("creates, completes, reopens, archives, and permanently deletes an item", async () => {
    const created = await request("/api/items", {
      method: "POST",
      body: JSON.stringify({ raw_text: "Dashboard-created item", primary_category: "General Task" })
    });
    expect(created.status).toBe(201);
    const result = await created.json<{ id: string }>();
    expect((await request(`/api/items/${result.id}`, {
      method: "PATCH", body: JSON.stringify({ status: "Done" })
    })).status).toBe(200);
    expect(await env.DB.prepare("SELECT status FROM item WHERE id = ?").bind(result.id).first("status")).toBe("Done");
    expect((await request(`/api/items/${result.id}`, { method: "PATCH", body: JSON.stringify({ status: "Open" }) })).status).toBe(200);
    expect((await request(`/api/items/${result.id}`, { method: "PATCH", body: JSON.stringify({ status: "Archived" }) })).status).toBe(200);
    expect((await request(`/api/items/${result.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM item WHERE id = ?").bind(result.id).first("count")).toBe(0);
  });
});
