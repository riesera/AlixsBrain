import { captureTitle, getMessageText } from "./telegram";
import type { Env, TelegramUpdate } from "./types";

export type StoreResult = "stored" | "duplicate" | "ignored";

export async function storeTelegramUpdate(update: TelegramUpdate, env: Env): Promise<StoreResult> {
  const message = update.message;
  if (!message) return "ignored";
  const rawText = getMessageText(message);
  if (rawText === null) return "ignored";

  const captureId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const sourceTimestamp = new Date(message.date * 1000).toISOString();
  const capture = env.DB.prepare(`
    INSERT OR IGNORE INTO raw_capture (
      id, created_at, source, source_update_id, source_message_id,
      source_user_id, source_chat_id, source_timestamp, raw_text, metadata_json
    ) VALUES (?, ?, 'telegram', ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    captureId, createdAt, String(update.update_id), String(message.message_id),
    message.from ? String(message.from.id) : null, String(message.chat.id),
    sourceTimestamp, rawText, JSON.stringify(update)
  );

  const statements: D1PreparedStatement[] = [capture, env.DB.prepare(`
    INSERT OR IGNORE INTO item (id, capture_id, title, status, created_at, updated_at)
    SELECT ?, id, ?, 'Inbox', ?, ?
    FROM raw_capture
    WHERE source = 'telegram' AND source_update_id = ?
  `).bind(itemId, captureTitle(rawText), createdAt, createdAt, String(update.update_id))];
  const results = await env.DB.batch(statements);
  return results[0].meta.changes === 0 ? "duplicate" : "stored";
}
