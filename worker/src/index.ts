import { storeTelegramUpdate } from "./captures";
import { confirmStored, isTelegramUpdate, secretsMatch } from "./telegram";
import { authenticationRequired, isDashboardAuthorized } from "./auth";
import { dashboardApi } from "./dashboard";
import type { Env } from "./types";

const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true });
    if (url.pathname !== "/telegram/webhook") {
      if (!isDashboardAuthorized(request, env)) return authenticationRequired();
      if (url.pathname.startsWith("/api/")) return dashboardApi(request, env, url.pathname);
      return env.ASSETS.fetch(request);
    }
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    if (!secretsMatch(request.headers.get("X-Telegram-Bot-Api-Secret-Token"), env.TELEGRAM_WEBHOOK_SECRET)) {
      return json({ error: "unauthorized" }, 401);
    }

    let payload: unknown;
    try { payload = await request.json(); }
    catch { return json({ error: "invalid_json" }, 400); }
    if (!isTelegramUpdate(payload)) return json({ error: "invalid_update" }, 400);

    const senderId = payload.message?.from?.id;
    if (senderId === undefined || String(senderId) !== env.ALLOWED_TELEGRAM_USER_ID) {
      return json({ error: "forbidden" }, 403);
    }

    const result = await storeTelegramUpdate(payload, env);
    console.log({
      event: "telegram_capture",
      result,
      update_id: payload.update_id
    });
    if (result === "stored" && payload.message) {
      try {
        await confirmStored(payload.message, env);
      } catch (error) {
        console.error({
          event: "telegram_confirmation_failed",
          error_name: error instanceof Error ? error.name : "UnknownError"
        });
      }
    }
    return json({ ok: true, result });
  }
} satisfies ExportedHandler<Env>;
