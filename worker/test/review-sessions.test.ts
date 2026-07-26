import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import {
  findActiveReviewSession,
  getReviewSession,
  saveReviewAnswer,
  setReviewStepState,
  startReviewSession,
  transitionReviewSession
} from "../src/review-sessions";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });

async function insertCanonicalTask(status: "Open" | "Done", rawText: string): Promise<string> {
  const captureId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO raw_capture
      (id, created_at, source, source_update_id, source_user_id, raw_text, metadata_json)
      VALUES (?, ?, 'telegram', ?, 'private-user', ?, '{"token":"private"}')`
    ).bind(captureId, now, crypto.randomUUID(), rawText),
    env.DB.prepare(`INSERT INTO item
      (id, capture_id, title, primary_category, status, created_at, updated_at)
      VALUES (?, ?, 'Task', 'General Task', ?, ?, ?)`
    ).bind(itemId, captureId, status, now, now)
  ]);
  return itemId;
}

describe("resumable guided review sessions", () => {
  it("starts with explicit week context and references only reviewable canonical tasks", async () => {
    const openId = await insertCanonicalTask("Open", "exact canonical text");
    const doneId = await insertCanonicalTask("Done", "completed text");
    const session = await startReviewSession(env.DB, {
      week_start: "2026-08-03", week_end: "2026-08-09", timezone: "America/Chicago"
    });

    expect(session).toMatchObject({ status: "in_progress", current_step: 1 });
    expect(session.steps.map(({ step }) => step)).toEqual([2]);
    expect(session.task_references).toContain(openId);
    expect(session.task_references).not.toContain(doneId);
    expect(JSON.stringify(session)).not.toContain("exact canonical text");
    expect(JSON.stringify(session)).not.toContain("private-user");
  });

  it("preserves raw typed and pasted answers exactly and resumes at the first incomplete step", async () => {
    const session = await startReviewSession(env.DB, {
      week_start: "2026-08-10", week_end: "2026-08-16", timezone: "America/Chicago"
    });
    await setReviewStepState(env.DB, session.id, 1, "completed");
    const raw = "  Thursday is constrained.\r\nKeep this spacing.  \n";
    await saveReviewAnswer(env.DB, session.id, {
      step: 3, field_key: "fixed_commitments", response_kind: "answered", input_kind: "pasted", raw_input: raw
    });
    await saveReviewAnswer(env.DB, session.id, {
      step: 3, field_key: "travel", response_kind: "unknown"
    });
    const progressed = await setReviewStepState(env.DB, session.id, 3, "completed");
    const resumed = await getReviewSession(env.DB, session.id);

    expect(progressed.current_step).toBe(4);
    expect(resumed.answers.find(answer => answer.field_key === "fixed_commitments")?.raw_input).toBe(raw);
    expect(resumed.answers.find(answer => answer.field_key === "travel")).toMatchObject({
      response_kind: "unknown", raw_input: null
    });
  });

  it("prevents duplicate active weeks and restarts without overwriting the prior session", async () => {
    const original = await startReviewSession(env.DB, {
      week_start: "2026-08-17", week_end: "2026-08-23", timezone: "America/Chicago"
    });
    await saveReviewAnswer(env.DB, original.id, {
      step: 3, field_key: "appointments", response_kind: "answered", raw_input: "Dentist"
    });
    await expect(startReviewSession(env.DB, {
      week_start: "2026-08-17", week_end: "2026-08-23", timezone: "America/Chicago"
    })).rejects.toMatchObject({ code: "conflict" });

    const replacement = await transitionReviewSession(env.DB, original.id, "restart");
    const preserved = await getReviewSession(env.DB, original.id);
    const active = await findActiveReviewSession(env.DB, "2026-08-17", "2026-08-23", "America/Chicago");

    expect(preserved.status).toBe("abandoned");
    expect(preserved.answers[0].raw_input).toBe("Dentist");
    expect(replacement).toMatchObject({ restarted_from_id: original.id, status: "in_progress" });
    expect(replacement.answers).toEqual([]);
    expect(active?.id).toBe(replacement.id);
  });

  it("supports completed and skipped sections and becomes ready only after collection is done", async () => {
    const session = await startReviewSession(env.DB, {
      week_start: "2026-08-24", week_end: "2026-08-30", timezone: "America/Chicago"
    });
    await setReviewStepState(env.DB, session.id, 1, "skipped");

    let progressed = session;
    for (let step = 3; step <= 13; step += 1) {
      progressed = await setReviewStepState(env.DB, session.id, step, step % 2 ? "completed" : "skipped");
    }
    expect(progressed).toMatchObject({ status: "ready_for_packet", current_step: 14 });
  });

  it("supports explicit completion and archival and prevents edits to terminal sessions", async () => {
    const session = await startReviewSession(env.DB, {
      week_start: "2026-08-31", week_end: "2026-09-06", timezone: "America/Chicago"
    });
    const completed = await transitionReviewSession(env.DB, session.id, "complete");
    expect(completed.status).toBe("completed");
    expect(completed.completed_at).not.toBeNull();
    await expect(saveReviewAnswer(env.DB, session.id, {
      step: 4, field_key: "urgent_work", response_kind: "none"
    })).rejects.toMatchObject({ code: "conflict" });
    const archived = await transitionReviewSession(env.DB, session.id, "archive");
    expect(archived.status).toBe("archived");
    expect(archived.archived_at).not.toBeNull();
  });
});
