import { secretsMatch } from "./telegram";
import type { Env } from "./types";

type JsonObject = Record<string, unknown>;

const json = (value: unknown, status = 200): Response =>
  Response.json(value, { status, headers: { "cache-control": "no-store" } });

const numberOrNull = (value: unknown, field: string): number | null => {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(field);
  return value;
};

const integerOrNull = (value: unknown, field: string): number | null => {
  const parsed = numberOrNull(value, field);
  if (parsed !== null && !Number.isInteger(parsed)) throw new Error(field);
  return parsed;
};

const string = (value: unknown, field: string, max = 100): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > max) throw new Error(field);
  return value;
};

const validDate = (value: string): boolean => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

const objectOrNull = (value: unknown, field: string): JsonObject | null => {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(field);
  return value as JsonObject;
};

const nutrientsObject = (value: unknown): JsonObject | null => {
  const object = objectOrNull(value, "nutrients");
  if (object === null) return null;
  const entries = Object.entries(object);
  if (entries.length > 100 || entries.some(([name, amount]) =>
    name.length === 0 || name.length > 100 || typeof amount !== "number" || !Number.isFinite(amount) || amount < 0
  )) throw new Error("nutrients");
  return object;
};

const exerciseObject = (value: unknown): JsonObject | null => {
  const object = objectOrNull(value, "exercise");
  if (object === null) return null;
  const entries = Object.entries(object);
  if (entries.length > 100 || entries.some(([name, detail]) => {
    if (name.length === 0 || name.length > 100 || !detail || typeof detail !== "object" || Array.isArray(detail)) return true;
    const record = detail as JsonObject;
    return !Number.isInteger(record.sessions) || (record.sessions as number) < 0 ||
      !Number.isInteger(record.minutes) || (record.minutes as number) < 0;
  })) throw new Error("exercise");
  return object;
};

export function isHealthSyncAuthorized(request: Request, env: Env): boolean {
  const authorization = request.headers.get("authorization");
  return typeof env.HEALTH_SYNC_TOKEN === "string" && env.HEALTH_SYNC_TOKEN.length > 0 &&
    authorization?.startsWith("Bearer ") === true &&
    secretsMatch(authorization.slice(7), env.HEALTH_SYNC_TOKEN);
}

export async function healthSyncApi(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (url.pathname !== "/api/health/daily") return null;
  if (!isHealthSyncAuthorized(request, env)) return json({ error: "unauthorized" }, 401);
  if (request.method !== "PUT") return json({ error: "method_not_allowed" }, 405);

  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("body");
    const body = value as JsonObject;
    const deviceId = string(body.device_id, "device_id", 80);
    const localDate = string(body.local_date, "local_date", 10);
    if (!validDate(localDate)) throw new Error("local_date");
    const timezone = string(body.timezone, "timezone", 80);
    try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(); }
    catch { throw new Error("timezone"); }
    const collectedAt = string(body.collected_at, "collected_at", 40);
    if (Number.isNaN(Date.parse(collectedAt))) throw new Error("collected_at");
    const exercise = exerciseObject(body.exercise);
    const nutrients = nutrientsObject(body.nutrients);
    const sources = body.source_packages;
    if (!Array.isArray(sources) || sources.length > 50 || sources.some(source =>
      typeof source !== "string" || source.length === 0 || source.length > 200
    )) throw new Error("source_packages");
    const receivedAt = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO health_daily_summary (
        device_id, local_date, timezone, collected_at, received_at, steps, sleep_minutes,
        exercise_json, water_milliliters, food_energy_kilocalories, energy_burned_kilocalories,
        nutrients_json, average_weight_kilograms, average_resting_heart_rate_bpm, source_packages_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id, local_date, timezone) DO UPDATE SET
        collected_at = excluded.collected_at, received_at = excluded.received_at,
        steps = excluded.steps, sleep_minutes = excluded.sleep_minutes, exercise_json = excluded.exercise_json,
        water_milliliters = excluded.water_milliliters,
        food_energy_kilocalories = excluded.food_energy_kilocalories,
        energy_burned_kilocalories = excluded.energy_burned_kilocalories,
        nutrients_json = excluded.nutrients_json,
        average_weight_kilograms = excluded.average_weight_kilograms,
        average_resting_heart_rate_bpm = excluded.average_resting_heart_rate_bpm,
        source_packages_json = excluded.source_packages_json
    `).bind(
      deviceId, localDate, timezone, collectedAt, receivedAt,
      integerOrNull(body.steps, "steps"), integerOrNull(body.sleep_minutes, "sleep_minutes"),
      exercise === null ? null : JSON.stringify(exercise), numberOrNull(body.water_milliliters, "water_milliliters"),
      numberOrNull(body.food_energy_kilocalories, "food_energy_kilocalories"),
      numberOrNull(body.energy_burned_kilocalories, "energy_burned_kilocalories"),
      nutrients === null ? null : JSON.stringify(nutrients),
      numberOrNull(body.average_weight_kilograms, "average_weight_kilograms"),
      integerOrNull(body.average_resting_heart_rate_bpm, "average_resting_heart_rate_bpm"),
      JSON.stringify([...new Set(sources)].sort())
    ).run();
    return json({ ok: true, local_date: localDate });
  } catch (error) {
    return json({ error: "invalid_health_summary", field: error instanceof Error ? error.message : "body" }, 400);
  }
}
