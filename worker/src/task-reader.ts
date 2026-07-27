import type { Domain, ItemFlag, ItemStatus, PrimaryCategory, RequestedBy } from "./types";

export const REVIEWABLE_TASK_STATUSES = ["Inbox", "Open", "Waiting"] as const satisfies readonly ItemStatus[];
export const ALL_TASK_STATUSES = ["Inbox", "Open", "Waiting", "Done", "Archived"] as const satisfies readonly ItemStatus[];

export interface CanonicalTask {
  id: string;
  capture_id: string;
  title: string;
  primary_category: PrimaryCategory | null;
  domain: Domain | null;
  requested_by: RequestedBy | null;
  project: string | null;
  status: ItemStatus;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  raw_text: string;
  source: string;
  flags: ItemFlag[];
}

interface CanonicalTaskRow extends Omit<CanonicalTask, "flags"> {
  flags_json: string;
}

export interface ReadCanonicalTasksOptions {
  /** Review reads default to incomplete canonical states only. */
  statuses?: readonly ItemStatus[];
  limit?: number;
}

/**
 * Reads verified canonical task fields from D1 without interface, auth, or
 * Telegram-specific concerns. Raw capture text is returned exactly as stored.
 */
export async function readCanonicalTasks(
  db: D1Database,
  options: ReadCanonicalTasksOptions = {}
): Promise<CanonicalTask[]> {
  const statuses = options.statuses ?? REVIEWABLE_TASK_STATUSES;
  const limit = options.limit ?? 500;
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("limit must be a positive integer");
  if (statuses.length === 0) return [];

  const placeholders = statuses.map(() => "?").join(", ");
  const { results } = await db.prepare(`
    SELECT i.id, i.capture_id, i.title, i.primary_category, i.domain, i.requested_by,
           i.project, i.status, i.due_at, i.created_at, i.updated_at,
           r.raw_text, r.source,
           COALESCE((SELECT json_group_array(flag) FROM item_flag WHERE item_id = i.id), '[]') AS flags_json
    FROM item i
    JOIN raw_capture r ON r.id = i.capture_id
    WHERE i.status IN (${placeholders})
    ORDER BY i.created_at DESC
    LIMIT ?
  `).bind(...statuses, limit).all<CanonicalTaskRow>();

  return results.map(({ flags_json, ...task }) => ({
    ...task,
    flags: JSON.parse(flags_json) as ItemFlag[]
  }));
}

/** Reads the same verified projection for explicit stable IDs, across all statuses. */
export async function readCanonicalTasksByIds(db: D1Database, ids: readonly string[]): Promise<CanonicalTask[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const placeholders = unique.map(() => "?").join(", ");
  const { results } = await db.prepare(`
    SELECT i.id, i.capture_id, i.title, i.primary_category, i.domain, i.requested_by,
           i.project, i.status, i.due_at, i.created_at, i.updated_at,
           r.raw_text, r.source,
           COALESCE((SELECT json_group_array(flag) FROM item_flag WHERE item_id = i.id), '[]') AS flags_json
    FROM item i
    JOIN raw_capture r ON r.id = i.capture_id
    WHERE i.id IN (${placeholders})
    ORDER BY i.created_at DESC
  `).bind(...unique).all<CanonicalTaskRow>();
  return results.map(({ flags_json, ...task }) => ({ ...task, flags: JSON.parse(flags_json) as ItemFlag[] }));
}
