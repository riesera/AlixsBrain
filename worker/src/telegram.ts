import type { Env, TelegramMessage, TelegramUpdate } from "./types";

export function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  if (!value || typeof value !== "object") return false;
  return Number.isInteger((value as Record<string, unknown>).update_id);
}

export function getMessageText(message: TelegramMessage): string | null {
  const value = message.text ?? message.caption;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function captureTitle(content: string): string {
  return content.split(/\r?\n/, 1)[0].trim().slice(0, 120);
}

export function secretsMatch(actual: string | null, expected: string): boolean {
  if (actual === null || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export async function confirmStored(message: TelegramMessage, env: Env): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: message.chat.id,
      text: "Saved.",
      reply_parameters: {
        message_id: message.message_id,
        allow_sending_without_reply: true
      }
    })
  });
  if (!response.ok) throw new Error(`Telegram confirmation failed with status ${response.status}`);
}
