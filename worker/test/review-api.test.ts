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
});
