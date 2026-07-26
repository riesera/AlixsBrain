import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

declare global {
  namespace Cloudflare {
    interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    TELEGRAM_WEBHOOK_SECRET: string;
    ALLOWED_TELEGRAM_USER_ID: string;
    TELEGRAM_BOT_TOKEN: string;
    DASHBOARD_USERNAME: string;
    DASHBOARD_PASSWORD: string;
    TEST_MIGRATIONS: D1Migration[];
    }
  }
}

const update = (updateId: number, text: string, userId = 123456789) => ({
  update_id: updateId,
  message: {
    message_id: updateId + 100, date: 1785024000, text,
    from: { id: userId, is_bot: false }, chat: { id: userId, type: "private" }
  }
});

const send = (payload: unknown, secret = "test-webhook-secret") => worker.fetch(
  new Request("https://example.com/telegram/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret },
    body: JSON.stringify(payload)
  }),
  env
);

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true, result: {} }));
});

describe("Telegram webhook", () => {
  it("stores ordinary text exactly and creates an Inbox item", async () => {
    const response = await send(update(1, "Call insurance\nAsk about the claim"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, result: "stored" });
    const capture = await env.DB.prepare("SELECT * FROM raw_capture WHERE source_update_id = ?").bind("1").first();
    expect(capture?.raw_text).toBe("Call insurance\nAsk about the claim");
    expect(capture?.source).toBe("telegram");
    expect(capture?.processed_at).toBeNull();
    const item = await env.DB.prepare("SELECT * FROM item WHERE capture_id = ?").bind(capture?.id).first();
    expect(item?.status).toBe("Inbox");
    expect(item?.primary_category).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-bot-token/sendMessage",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("does not treat a Telegram command as automatic categorization", async () => {
    expect((await send(update(2, "/task Call insurance\nAsk about the claim"))).status).toBe(200);
    const item = await env.DB.prepare(`SELECT i.*, r.raw_text FROM item i JOIN raw_capture r ON r.id = i.capture_id WHERE r.source_update_id = '2'`).first();
    expect(item?.title).toBe("/task Call insurance");
    expect(item?.raw_text).toBe("/task Call insurance\nAsk about the claim");
    expect(item?.status).toBe("Inbox");
  });

  it("does not duplicate a retried update", async () => {
    await send(update(3, "/decision Keep Telegram replaceable"));
    const retry = await send(update(3, "/decision Keep Telegram replaceable"));
    expect(await retry.json()).toEqual({ ok: true, result: "duplicate" });
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM raw_capture WHERE source_update_id = '3'").first("count")).toBe(1);
    expect(await env.DB.prepare(`SELECT COUNT(*) AS count FROM item i JOIN raw_capture r ON r.id = i.capture_id WHERE r.source_update_id = '3'`).first("count")).toBe(1);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects an invalid webhook secret", async () => {
    expect((await send(update(4, "Do not store"), "wrong-secret")).status).toBe(401);
  });

  it("rejects a sender outside the allowlist", async () => {
    expect((await send(update(5, "Do not store", 999))).status).toBe(403);
  });

  it("acknowledges unsupported message types without storing them", async () => {
    const payload = update(6, "temporary");
    const withoutText = { ...payload, message: { ...payload.message, text: undefined } };
    expect(await (await send(withoutText)).json()).toEqual({ ok: true, result: "ignored" });
  });
});
