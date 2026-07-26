import { readWeeklyHealthSummary } from "./health-reader";
import type { Env } from "./types";

const json = (value: unknown, status = 200): Response =>
  Response.json(value, { status, headers: { "cache-control": "no-store" } });

const validDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

export async function healthReadApi(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (url.pathname !== "/api/health/weekly") return null;
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const weekStart = url.searchParams.get("week_start") ?? "";
  const timezone = url.searchParams.get("timezone") ?? "";
  if (!validDate(weekStart)) {
    return json({ error: "invalid week_start" }, 400);
  }
  if (!timezone || timezone.length > 80) return json({ error: "invalid timezone" }, 400);
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(); }
  catch { return json({ error: "invalid timezone" }, 400); }
  return json(await readWeeklyHealthSummary(env.DB, weekStart, timezone));
}
