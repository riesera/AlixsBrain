import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createReviewPacket, generateReviewPacket, latestReviewPacket } from "../src/review-packet";
import { saveReviewAnswer, setReviewStepState, startReviewSession } from "../src/review-sessions";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });

async function readySession(weekStart = "2026-08-03", weekEnd = "2026-08-09") {
  const captureId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const now = "2026-07-26T12:00:00.000Z";
  const raw = "  Exact raw task wording\nincluding `markdown` and spacing.  ";
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO raw_capture
      (id, created_at, source, source_update_id, source_user_id, raw_text, metadata_json)
      VALUES (?, ?, 'telegram', ?, 'private-user', ?, '{"token":"private-token"}')`)
      .bind(captureId, now, crypto.randomUUID(), raw),
    env.DB.prepare(`INSERT INTO item
      (id, capture_id, title, primary_category, domain, requested_by, project, status, due_at, created_at, updated_at)
      VALUES (?, ?, 'Exact raw task wording', 'Project Work', 'Business', 'Self', 'Packet Test', 'Open',
        '2026-08-04T15:00:00.000Z', ?, ?)`)
      .bind(itemId, captureId, now, now)
  ]);
  const session = await startReviewSession(env.DB, {
    week_start: weekStart, week_end: weekEnd, timezone: "America/Chicago"
  });
  await saveReviewAnswer(env.DB, session.id, {
    step: 1, field_key: "week_context", response_kind: "answered", raw_input: "  Kid week; protect recovery.  \n"
  });
  await saveReviewAnswer(env.DB, session.id, {
    step: 12, field_key: "candidate_decisions", response_kind: "answered", raw_input: "Discuss whether to pause Project X."
  });
  await setReviewStepState(env.DB, session.id, 1, "completed");
  for (let step = 3; step <= 13; step += 1) {
    await setReviewStepState(env.DB, session.id, step, step === 9 ? "skipped" : "completed");
  }
  return { sessionId: session.id, itemId, raw };
}

describe("deterministic Sunday Planning Packet", () => {
  it("uses the stable 23-section order, provenance, frozen tasks, raw appendices, and visible gaps", async () => {
    const { sessionId, itemId, raw } = await readySession();
    const packet = await generateReviewPacket(env.DB, sessionId, "2026-08-02T18:00:00.000Z");
    const markdown = packet.markdown;
    let previous = -1;
    for (let section = 1; section <= 23; section += 1) {
      const index = markdown.indexOf(`## ${section}.`);
      expect(index, `section ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(markdown).toContain("[SYSTEM FACT]");
    expect(markdown).toContain("[MANUAL INPUT]");
    expect(markdown).toContain("[GENERATED FLAG]");
    expect(markdown).toContain("[MISSING]");
    expect(markdown).toContain("[UNSUPPORTED]");
    expect(markdown).toContain(itemId);
    expect(markdown).toContain(raw);
    expect(markdown).toContain("Kid week; protect recovery.");
    expect(markdown).toContain("Review section skipped: Learning.");
    expect(markdown).toContain("No carry-forward status was inferred");
    expect(markdown).not.toContain("private-user");
    expect(markdown).not.toContain("private-token");

    const repeated = await generateReviewPacket(env.DB, sessionId, "2026-08-02T18:00:00.000Z");
    expect(repeated.markdown).toBe(markdown);
  });

  it("stores immutable incrementing packet versions and returns the latest", async () => {
    const { sessionId } = await readySession("2026-08-10", "2026-08-16");
    const first = await createReviewPacket(env.DB, sessionId);
    const second = await createReviewPacket(env.DB, sessionId);
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(second.id).not.toBe(first.id);
    expect((await latestReviewPacket(env.DB, sessionId))?.id).toBe(second.id);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM sunday_review_packet WHERE session_id = ?")
      .bind(sessionId).first("count")).toBe(2);
  });

  it("refuses packet generation before collection is ready", async () => {
    const session = await startReviewSession(env.DB, {
      week_start: "2026-10-05", week_end: "2026-10-11", timezone: "America/Chicago"
    });
    await expect(createReviewPacket(env.DB, session.id)).rejects.toMatchObject({ code: "conflict" });
  });
});
