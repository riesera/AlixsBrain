import type { Domain, Env, ItemFlag, ItemStatus, PrimaryCategory, RequestedBy } from "./types";
import { ALL_TASK_STATUSES, readCanonicalTasks } from "./task-reader";

const CATEGORIES = new Set<PrimaryCategory>([
  "Procurement", "Admin & Finance", "Communication & Follow-Up", "Scheduling & Coordination",
  "Project Work", "Problems to Solve", "Research / Figure Out", "General Task"
]);
const DOMAINS = new Set<Domain>(["Business", "Personal", "Home", "Health", "Family", "Learning"]);
const REQUESTERS = new Set<RequestedBy>(["Self", "Dan", "Customer", "Team", "Vendor", "System", "Other"]);
const FLAGS = new Set<ItemFlag>(["Urgent", "Time-Sensitive", "Waiting On", "Quick Task", "Deep Work"]);
const STATUSES = new Set<ItemStatus>(["Inbox", "Open", "Waiting", "Done", "Archived"]);

const json = (value: unknown, status = 200): Response =>
  Response.json(value, { status, headers: { "cache-control": "no-store" } });

async function requestBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json();
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  } catch { return null; }
}

const cleanText = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const optionalText = (value: unknown): string | null => cleanText(value) || null;
const allowed = <T extends string>(value: unknown, choices: Set<T>): T | null =>
  typeof value === "string" && choices.has(value as T) ? value as T : null;

function validFlags(value: unknown): ItemFlag[] | null {
  if (!Array.isArray(value)) return null;
  const unique = [...new Set(value)];
  return unique.every(flag => typeof flag === "string" && FLAGS.has(flag as ItemFlag)) ? unique as ItemFlag[] : null;
}

async function listItems(env: Env, inboxOnly = false): Promise<Response> {
  return json(await readCanonicalTasks(env.DB, {
    statuses: inboxOnly ? ["Inbox"] : ALL_TASK_STATUSES
  }));
}

async function replaceFlags(env: Env, itemId: string, flags: ItemFlag[]): Promise<void> {
  const statements = [env.DB.prepare("DELETE FROM item_flag WHERE item_id = ?").bind(itemId)];
  for (const flag of flags) {
    statements.push(env.DB.prepare("INSERT INTO item_flag (item_id, flag) VALUES (?, ?)").bind(itemId, flag));
  }
  await env.DB.batch(statements);
}

export async function dashboardApi(request: Request, env: Env, pathname: string): Promise<Response> {
  if (request.method === "GET" && pathname === "/api/status") {
    const status = await env.DB.prepare(`
      SELECT (SELECT COUNT(*) FROM raw_capture) AS capture_count,
             (SELECT COUNT(*) FROM item WHERE status = 'Inbox') AS inbox_count,
             (SELECT COUNT(*) FROM item) AS item_count,
             (SELECT COUNT(*) FROM item WHERE status IN ('Open', 'Waiting')) AS open_item_count,
             (SELECT MAX(created_at) FROM raw_capture) AS last_capture_at
    `).first();
    return json({ ok: true, database: status });
  }
  if (request.method === "GET" && pathname === "/api/captures") return listItems(env, true);
  if (request.method === "GET" && pathname === "/api/items") return listItems(env);

  if (request.method === "POST" && pathname === "/api/items") {
    const payload = await requestBody(request);
    if (!payload) return json({ error: "invalid_json" }, 400);
    const rawText = cleanText(payload.raw_text);
    const suppliedTitle = cleanText(payload.title);
    if (!rawText && !suppliedTitle) return json({ error: "content is required" }, 400);
    const category = payload.primary_category == null || payload.primary_category === "" ? null : allowed(payload.primary_category, CATEGORIES);
    if (payload.primary_category && !category) return json({ error: "invalid primary_category" }, 400);
    const flags = payload.flags == null ? [] : validFlags(payload.flags);
    if (!flags) return json({ error: "invalid flags" }, 400);

    const captureId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = suppliedTitle || rawText.split(/\r?\n/, 1)[0].slice(0, 120);
    const status: ItemStatus = category ? "Open" : "Inbox";
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO raw_capture
        (id, created_at, source, source_update_id, raw_text, metadata_json, created_item_id)
        VALUES (?, ?, 'dashboard', ?, ?, '{}', ?)`
      ).bind(captureId, now, crypto.randomUUID(), rawText || title, itemId),
      env.DB.prepare(`INSERT INTO item
        (id, capture_id, title, primary_category, domain, requested_by, project, status, due_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        itemId, captureId, title, category,
        allowed(payload.domain, DOMAINS), allowed(payload.requested_by, REQUESTERS), optionalText(payload.project),
        status, optionalText(payload.due_at), now, now
      )
    ]);
    await replaceFlags(env, itemId, flags);
    console.log({ event: "dashboard_item_created", item_id: itemId, capture_id: captureId, category, status });
    return json({ id: itemId, capture_id: captureId }, 201);
  }

  const match = pathname.match(/^\/api\/items\/([^/]+)$/);
  if (match && request.method === "PATCH") {
    const itemId = decodeURIComponent(match[1]);
    const payload = await requestBody(request);
    if (!payload) return json({ error: "invalid_json" }, 400);
    const current = await env.DB.prepare("SELECT * FROM item WHERE id = ?").bind(itemId).first<Record<string, unknown>>();
    if (!current) return json({ error: "item_not_found" }, 404);

    const category = "primary_category" in payload
      ? (payload.primary_category === null || payload.primary_category === "" ? null : allowed(payload.primary_category, CATEGORIES))
      : current.primary_category as PrimaryCategory | null;
    if (payload.primary_category && !category) return json({ error: "invalid primary_category" }, 400);
    let status = "status" in payload ? allowed(payload.status, STATUSES) : current.status as ItemStatus;
    if (!status) return json({ error: "invalid status" }, 400);
    if (category && status === "Inbox" && !("status" in payload)) status = "Open";
    if (!category && !new Set<ItemStatus>(["Inbox", "Archived"]).has(status)) {
      return json({ error: "categorize the item before changing this status" }, 400);
    }
    const flags = "flags" in payload ? validFlags(payload.flags) : null;
    if ("flags" in payload && !flags) return json({ error: "invalid flags" }, 400);
    const title = "title" in payload ? cleanText(payload.title) : current.title as string;
    if (!title) return json({ error: "title is required" }, 400);

    const now = new Date().toISOString();
    await env.DB.prepare(`UPDATE item SET
      title = ?, primary_category = ?, domain = ?, requested_by = ?, project = ?, status = ?, due_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      title, category,
      "domain" in payload ? allowed(payload.domain, DOMAINS) : current.domain,
      "requested_by" in payload ? allowed(payload.requested_by, REQUESTERS) : current.requested_by,
      "project" in payload ? optionalText(payload.project) : current.project,
      status,
      "due_at" in payload ? optionalText(payload.due_at) : current.due_at,
      now, itemId
    ).run();
    if (flags) await replaceFlags(env, itemId, flags);
    await env.DB.prepare(`UPDATE raw_capture SET processed_at = ? WHERE id = ?`).bind(
      status === "Inbox" ? null : now, current.capture_id
    ).run();
    console.log({ event: "item_updated", item_id: itemId, category, status });
    return json({ ok: true });
  }

  if (match && request.method === "DELETE") {
    const itemId = decodeURIComponent(match[1]);
    const current = await env.DB.prepare("SELECT capture_id FROM item WHERE id = ?").bind(itemId).first<{ capture_id: string }>();
    if (!current) return json({ error: "item_not_found" }, 404);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM item_flag WHERE item_id = ?").bind(itemId),
      env.DB.prepare("DELETE FROM item WHERE id = ?").bind(itemId),
      env.DB.prepare("DELETE FROM raw_capture WHERE id = ?").bind(current.capture_id)
    ]);
    console.log({ event: "item_deleted", item_id: itemId });
    return new Response(null, { status: 204 });
  }

  return json({ error: "not_found" }, 404);
}
