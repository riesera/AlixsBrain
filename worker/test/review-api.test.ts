import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import worker from "../src/index";

const auth = `Basic ${btoa("test-user:test-password")}`;
const request = (path: string, init: RequestInit = {}) => worker.fetch(new Request(`https://example.com${path}`, {
  ...init,
  headers: { authorization: auth, "content-type": "application/json", ...(init.headers || {}) }
}), env);

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });

describe("review session API", () => {
  it("uses existing dashboard authentication", async () => {
    const response = await worker.fetch(new Request("https://example.com/api/reviews/active"), env);
    expect(response.status).toBe(401);
  });

  it("creates, answers, advances, and resumes a session", async () => {
    const guide = await request("/api/reviews/guide");
    const steps = await guide.json<Array<{ step: number; title: string; questions: Array<{ field_key: string; prompt: string }> }>>();
    expect(steps).toHaveLength(13);
    expect(steps[0]).toMatchObject({ step: 1, title: "Establish the week" });
    expect(steps[0].questions[0]).toMatchObject({ field_key: "week_context" });
    expect(steps[0].questions[0].prompt).toContain("week");

    const created = await request("/api/reviews", {
      method: "POST",
      body: JSON.stringify({ week_start: "2026-09-07", week_end: "2026-09-13", timezone: "America/Chicago" })
    });
    expect(created.status).toBe(201);
    const session = await created.json<{ id: string }>();

    await request(`/api/reviews/${session.id}/steps/1`, {
      method: "PUT", body: JSON.stringify({ state: "completed" })
    });

    const answered = await request(`/api/reviews/${session.id}/answers/3/fixed_commitments`, {
      method: "PUT",
      body: JSON.stringify({ response_kind: "answered", input_kind: "typed", raw_input: "  Monday meeting  " })
    });
    expect(answered.status).toBe(200);
    const advanced = await request(`/api/reviews/${session.id}/steps/3`, {
      method: "PUT", body: JSON.stringify({ state: "completed" })
    });
    expect((await advanced.json<{ current_step: number }>()).current_step).toBe(4);

    const active = await request("/api/reviews/active?week_start=2026-09-07&week_end=2026-09-13&timezone=America%2FChicago");
    const resumed = await active.json<{ id: string; answers: Array<{ raw_input: string }> }>();
    expect(resumed.id).toBe(session.id);
    expect(resumed.answers[0].raw_input).toBe("  Monday meeting  ");
  });

  it("rejects implicit week defaults and invalid answer shapes", async () => {
    const missingWeek = await request("/api/reviews", { method: "POST", body: "{}" });
    expect(missingWeek.status).toBe(400);

    const created = await request("/api/reviews", {
      method: "POST",
      body: JSON.stringify({ week_start: "2026-09-14", week_end: "2026-09-20", timezone: "America/Chicago" })
    });
    const session = await created.json<{ id: string }>();
    const invalid = await request(`/api/reviews/${session.id}/answers/3/commitments`, {
      method: "PUT", body: JSON.stringify({ response_kind: "answered" })
    });
    expect(invalid.status).toBe(400);
  });

  it("snapshots the prior seven health days and explicitly refreshes existing context", async () => {
    const created = await request("/api/reviews", {
      method: "POST",
      body: JSON.stringify({ week_start: "2026-09-21", week_end: "2026-09-27", timezone: "America/Chicago" })
    });
    const session = await created.json<{ id: string; health_context: { week_start: string; week_end: string; coverage: { stored_days: number } } }>();
    expect(session.health_context).toMatchObject({ week_start: "2026-09-14", week_end: "2026-09-20", coverage: { stored_days: 0 } });

    await env.DB.prepare(`INSERT INTO health_daily_summary (
      device_id, local_date, timezone, collected_at, received_at, steps, sleep_minutes,
      exercise_json, water_milliliters, food_energy_kilocalories, energy_burned_kilocalories,
      nutrients_json, average_weight_kilograms, average_resting_heart_rate_bpm, source_packages_json
    ) VALUES ('api-review-phone', '2026-09-20', 'America/Chicago', ?, ?, 8000, NULL, '{}', NULL, NULL, 2200, '{}', NULL, NULL, '[]')`)
      .bind("2026-09-20T23:00:00Z", "2026-09-20T23:01:00Z").run();

    const refreshed = await request(`/api/reviews/${session.id}/health-context`, { method: "PUT" });
    const value = await refreshed.json<{ health_context: { coverage: { stored_days: number }; metrics: { steps: { total: number } } } }>();
    expect(value.health_context.coverage.stored_days).toBe(1);
    expect(value.health_context.metrics.steps.total).toBe(8000);
  });

  it("generates and retrieves an immutable Markdown packet through the authenticated API", async () => {
    const created = await request("/api/reviews", {
      method: "POST",
      body: JSON.stringify({ week_start: "2026-10-12", week_end: "2026-10-18", timezone: "America/Chicago" })
    });
    const session = await created.json<{ id: string }>();
    await request(`/api/reviews/${session.id}/steps/1`, { method: "PUT", body: JSON.stringify({ state: "skipped" }) });
    for (let step = 3; step <= 13; step += 1) {
      await request(`/api/reviews/${session.id}/steps/${step}`, { method: "PUT", body: JSON.stringify({ state: "skipped" }) });
    }
    const generated = await request(`/api/reviews/${session.id}/packet`, { method: "POST" });
    expect(generated.status).toBe(201);
    const packet = await generated.json<{ version: number; markdown: string }>();
    expect(packet.version).toBe(1);
    expect(packet.markdown).toContain("# Sunday Planning Packet");
    const latest = await request(`/api/reviews/${session.id}/packet`);
    expect((await latest.json<{ version: number }>()).version).toBe(1);
  });
});
