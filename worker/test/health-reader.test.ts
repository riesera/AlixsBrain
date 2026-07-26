import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import worker from "../src/index";

const auth = `Basic ${btoa("test-user:test-password")}`;

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  const statements = [];
  for (let index = 0; index < 7; index += 1) {
    const date = `2026-07-${String(6 + index).padStart(2, "0")}`;
    statements.push(env.DB.prepare(`INSERT INTO health_daily_summary (
      device_id, local_date, timezone, collected_at, received_at, steps, sleep_minutes,
      exercise_json, water_milliliters, food_energy_kilocalories, energy_burned_kilocalories,
      nutrients_json, average_weight_kilograms, average_resting_heart_rate_bpm, source_packages_json
    ) VALUES ('weekly-test-phone', ?, 'Pacific/Honolulu', ?, ?, ?, ?, ?, ?, ?, 2000, ?, ?, NULL, ?)`)
      .bind(
        date, `${date}T23:00:00Z`, `${date}T23:01:00Z`, (index + 1) * 1000,
        index === 6 ? null : 420,
        index < 2 ? JSON.stringify({ Walking: { sessions: index + 1, minutes: (index + 1) * 20 } }) : "{}",
        index < 3 ? 1000 : null,
        index < 2 ? 1800 + index * 100 : null,
        index < 2 ? JSON.stringify({ Protein: 50 + index * 20 }) : "{}",
        index < 2 ? 70 + index * 2 : null,
        JSON.stringify(index % 2 ? ["source.b"] : ["source.a"])
      ));
  }
  await env.DB.batch(statements);
});

describe("weekly health reader API", () => {
  it("requires dashboard authentication", async () => {
    const response = await worker.fetch(new Request("https://example.com/api/health/weekly?week_start=2026-07-06&timezone=Pacific%2FHonolulu"), env);
    expect(response.status).toBe(401);
  });

  it("returns deterministic totals, coverage, ranges, and friendly exercise summaries", async () => {
    const response = await worker.fetch(new Request(
      "https://example.com/api/health/weekly?week_start=2026-07-06&timezone=Pacific%2FHonolulu",
      { headers: { authorization: auth } }
    ), env);
    expect(response.status).toBe(200);
    const summary = await response.json<any>();
    expect(summary.week_end).toBe("2026-07-12");
    expect(summary.coverage).toEqual({ requested_days: 7, stored_days: 7, device_count: 1 });
    expect(summary.metrics.steps).toMatchObject({ coverage_days: 7, total: 28000, average_recorded_day: 4000, minimum: 1000, maximum: 7000 });
    expect(summary.metrics.sleep_minutes).toMatchObject({ coverage_days: 6, total: 2520, average_recorded_day: 420 });
    expect(summary.metrics.energy_burned_kilocalories.total).toBe(14000);
    expect(summary.metrics.energy_balance_kilocalories).toBeNull();
    expect(summary.exercises.Walking).toEqual({ sessions: 3, minutes: 60, coverage_days: 2 });
    expect(summary.nutrients.Protein).toEqual({ total: 120, coverage_days: 2, average_logged_day: 60 });
    expect(summary.source_packages).toEqual(["source.a", "source.b"]);
    expect(summary.warnings.join(" ")).toContain("Food energy was logged on 2 of 7 days");
    expect(summary.days).toHaveLength(7);
  });

  it("rejects invalid dates", async () => {
    const response = await worker.fetch(new Request(
      "https://example.com/api/health/weekly?week_start=nope&timezone=Pacific%2FHonolulu",
      { headers: { authorization: auth } }
    ), env);
    expect(response.status).toBe(400);
  });
});
