import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import worker from "../src/index";

const payload = {
  device_id: "phone-test", local_date: "2026-07-25", timezone: "America/Chicago",
  collected_at: "2026-07-26T20:00:00Z", steps: 7000, sleep_minutes: null,
  exercise: { Walking: { sessions: 2, minutes: 45 } }, water_milliliters: 1200,
  food_energy_kilocalories: 1900, energy_burned_kilocalories: 2300,
  nutrients: { Protein: 90.5 }, average_weight_kilograms: null,
  average_resting_heart_rate_bpm: 61, source_packages: ["source.b", "source.a", "source.a"]
};

const sync = (body: unknown, token = "test-health-token") => worker.fetch(new Request("https://example.com/api/health/daily", {
  method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify(body)
}), env);

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });

describe("health daily sync", () => {
  it("requires the independent device token", async () => {
    expect((await sync(payload, "wrong")).status).toBe(401);
  });

  it("stores nullable daily summaries and idempotently replaces a corrected day", async () => {
    expect((await sync(payload)).status).toBe(200);
    expect((await sync({ ...payload, steps: 7100 })).status).toBe(200);
    const row = await env.DB.prepare("SELECT * FROM health_daily_summary WHERE device_id = ? AND local_date = ?")
      .bind("phone-test", "2026-07-25").first<Record<string, unknown>>();
    expect(row?.steps).toBe(7100);
    expect(row?.sleep_minutes).toBeNull();
    expect(row?.source_packages_json).toBe('["source.a","source.b"]');
    expect(JSON.parse(String(row?.nutrients_json))).toEqual({ Protein: 90.5 });
  });

  it("rejects malformed and negative measurements", async () => {
    const response = await sync({ ...payload, steps: -1 });
    expect(response.status).toBe(400);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM health_daily_summary WHERE steps = -1").first("count")).toBe(0);
    expect((await sync({ ...payload, nutrients: { Protein: "unknown" } })).status).toBe(400);
    expect((await sync({ ...payload, exercise: { Walking: { sessions: 1, minutes: -4 } } })).status).toBe(400);
  });
});
