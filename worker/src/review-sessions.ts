import { readCanonicalTasks } from "./task-reader";
import { addDays, readWeeklyHealthSummary, type WeeklyHealthSummary } from "./health-reader";

export type ReviewSessionStatus =
  "not_started" | "in_progress" | "ready_for_packet" | "completed" | "abandoned" | "archived";
export type ReviewResponseKind = "answered" | "none" | "not_applicable" | "unknown" | "skipped" | "deferred";
export type ReviewInputKind = "typed" | "pasted" | "uploaded_summary";
export type ReviewStepState = "completed" | "skipped";

export interface ReviewStepDefinition {
  step: number;
  title: string;
  purpose: string;
  questions: readonly ReviewQuestionDefinition[];
  automatic: boolean;
  skippable: boolean;
}

export interface ReviewQuestionDefinition {
  field_key: string;
  prompt: string;
  help: string;
}

export const REVIEW_GUIDE: readonly ReviewStepDefinition[] = [
  { step: 1, title: "Establish the week", purpose: "Record capacity and unusual circumstances for the explicit week.", questions: [
    { field_key: "week_context", prompt: "What should this review know about the week before we begin?", help: "Include kid-week status, unusual circumstances, travel, illness, or an overall capacity estimate. Approximate language is fine." }
  ], automatic: false, skippable: true },
  { step: 2, title: "Load and validate task data", purpose: "Reference reviewable canonical tasks and record retrieval time.", questions: [], automatic: true, skippable: false },
  { step: 3, title: "Fixed commitments", purpose: "Collect appointments, meetings, obligations, travel, and constrained days.", questions: [
    { field_key: "fixed_commitments", prompt: "What fixed commitments or constrained time should planning work around?", help: "Include appointments, meetings, office days, installs, kid obligations, travel, deadlines, preparation time, and unusually busy days." }
  ], automatic: false, skippable: true },
  { step: 4, title: "Urgent and administrative work", purpose: "Collect time-sensitive operational context not already represented by tasks.", questions: [
    { field_key: "urgent_admin_context", prompt: "What operational work could become a problem or needs timely attention?", help: "Consider customers, vendors, procurement, shipping, finance, administration, scheduling, and sales follow-up. Listing it here does not automatically make it urgent." }
  ], automatic: false, skippable: true },
  { step: 5, title: "Projects", purpose: "Collect current state, blockers, next actions, and proposed weekly state.", questions: [
    { field_key: "project_context", prompt: "Which projects need a deliberate status or outcome this week?", help: "For each relevant project, note its state, next action, blocker, desired outcome, and whether it should be active, maintenance-only, waiting, paused, inactive, or backlog." }
  ], automatic: false, skippable: true },
  { step: 6, title: "Waiting on", purpose: "Separate dependencies and identify relevant follow-up decisions.", questions: [
    { field_key: "waiting_on", prompt: "What are you waiting on, and does anything need follow-up this week?", help: "Separate Dan, team members, customers, vendors, outside conditions, and unknown owners where useful." }
  ], automatic: false, skippable: true },
  { step: 7, title: "Carry-forward items", purpose: "Record deliberate dispositions only when reliable history exists.", questions: [
    { field_key: "carry_forward", prompt: "Are there repeatedly unfinished items that need a deliberate decision?", help: "Only include items supported by reliable history or your own knowledge. Possible decisions include schedule, delegate, break down, pause, drop, discuss, or keep visible." }
  ], automatic: false, skippable: true },
  { step: 8, title: "Health and capacity", purpose: "Collect non-diagnostic planning context and realistic minimums.", questions: [
    { field_key: "health_capacity", prompt: "What health, energy, or recovery context should shape the coming week?", help: "Approximate descriptions are welcome. Consider workouts, activity, sleep, hydration, nutrition, stress, energy, pain, illness, recovery limits, and realistic minimums." }
  ], automatic: false, skippable: true },
  { step: 9, title: "Learning", purpose: "Collect active learning progress, next actions, and realistic commitments.", questions: [
    { field_key: "learning", prompt: "Which learning areas are active, and what would realistic progress look like?", help: "Consider Spanish, books, courses, assignments, technical learning, software projects, current progress, and the next study action." }
  ], automatic: false, skippable: true },
  { step: 10, title: "Home, family, dogs, and restoration", purpose: "Collect relevant household, relationship, caregiving, and restorative context.", questions: [
    { field_key: "home_family", prompt: "What home, family, or coordination needs belong in this week?", help: "Include cleaning, maintenance, errands, kids, family obligations, and Dan coordination." },
    { field_key: "dogs", prompt: "Do Rez or Billie need anything this week?", help: "Consider health, supplies, grooming, training, or monitoring. Use None when nothing needs attention." },
    { field_key: "restoration", prompt: "What restoration or enjoyment would help make this a sustainable week?", help: "Reading, baking, rest, outdoor time, social plans, and creative interests are legitimate planning inputs—not leftovers." }
  ], automatic: false, skippable: true },
  { step: 11, title: "Activate roles", purpose: "Choose role states and limited outcomes without imposing quotas.", questions: [
    { field_key: "roles", prompt: "Which roles should be active or maintenance-only this week?", help: "Other roles may be waiting, paused, inactive, or backlog. For active roles, limit outcomes and note minimum acceptable progress or protected time." }
  ], automatic: false, skippable: true },
  { step: 12, title: "Candidate decisions", purpose: "Collect unresolved choices and possible workload classifications without approving changes.", questions: [
    { field_key: "candidate_decisions", prompt: "What decisions or tradeoffs should the planning conversation resolve?", help: "Include not-this-week, pause, drop, discuss, high-brainpower, low-brainpower, and unresolved candidates. These are not approved external changes." }
  ], automatic: false, skippable: true },
  { step: 13, title: "Review completeness", purpose: "Record skipped sections, optional gaps, unsupported views, and stale-data concerns.", questions: [
    { field_key: "completeness", prompt: "Is anything important missing, uncertain, unsupported, stale, or deliberately skipped?", help: "Record visible gaps rather than filling them with guesses. Optional gaps do not prevent moving forward." }
  ], automatic: false, skippable: true }
] as const;

export interface ReviewAnswer {
  step: number;
  field_key: string;
  response_kind: ReviewResponseKind;
  input_kind: ReviewInputKind;
  raw_input: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewSession {
  id: string;
  week_start: string;
  week_end: string;
  timezone: string;
  status: ReviewSessionStatus;
  current_step: number;
  task_retrieved_at: string;
  restarted_from_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  abandoned_at: string | null;
  archived_at: string | null;
  task_references: string[];
  steps: Array<{ step: number; state: ReviewStepState; updated_at: string }>;
  answers: ReviewAnswer[];
  health_context: WeeklyHealthSummary | null;
}

interface ReviewSessionRow extends Omit<ReviewSession, "task_references" | "steps" | "answers" | "health_context"> {}

export class ReviewSessionError extends Error {
  constructor(public readonly code: "invalid_request" | "not_found" | "conflict", message: string) {
    super(message);
  }
}

const COLLECTION_STEPS = Array.from({ length: 13 }, (_, index) => index + 1);
const AUTOMATIC_STEPS = new Set([2]);
const ACTIVE_STATUSES = new Set<ReviewSessionStatus>(["not_started", "in_progress", "ready_for_packet"]);

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateWeek(weekStart: string, weekEnd: string, timezone: string): void {
  if (!validDate(weekStart) || !validDate(weekEnd) || weekEnd < weekStart) {
    throw new ReviewSessionError("invalid_request", "week_start and week_end must be valid ordered YYYY-MM-DD dates");
  }
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(); }
  catch { throw new ReviewSessionError("invalid_request", "timezone must be a valid IANA timezone"); }
}

function validateStep(step: number): void {
  if (!Number.isInteger(step) || step < 1 || step > 13) {
    throw new ReviewSessionError("invalid_request", "step must be an integer from 1 through 13");
  }
}

function validateFieldKey(fieldKey: string): void {
  if (!/^[a-z][a-z0-9_]{0,79}$/.test(fieldKey)) {
    throw new ReviewSessionError("invalid_request", "field_key must be lowercase snake_case and at most 80 characters");
  }
}

async function sessionRow(db: D1Database, id: string): Promise<ReviewSessionRow> {
  const row = await db.prepare("SELECT * FROM sunday_review_session WHERE id = ?").bind(id).first<ReviewSessionRow>();
  if (!row) throw new ReviewSessionError("not_found", "review_session_not_found");
  return row;
}

async function assertEditable(db: D1Database, id: string): Promise<ReviewSessionRow> {
  const row = await sessionRow(db, id);
  if (!ACTIVE_STATUSES.has(row.status)) {
    throw new ReviewSessionError("conflict", `review session is ${row.status} and cannot be edited`);
  }
  return row;
}

export async function getReviewSession(db: D1Database, id: string): Promise<ReviewSession> {
  const row = await sessionRow(db, id);
  const [references, steps, answers, health] = await Promise.all([
    db.prepare("SELECT item_id FROM sunday_review_task_reference WHERE session_id = ? ORDER BY item_id")
      .bind(id).all<{ item_id: string }>(),
    db.prepare("SELECT step, state, updated_at FROM sunday_review_step_state WHERE session_id = ? ORDER BY step")
      .bind(id).all<{ step: number; state: ReviewStepState; updated_at: string }>(),
    db.prepare(`SELECT step, field_key, response_kind, input_kind, raw_input, created_at, updated_at
      FROM sunday_review_answer WHERE session_id = ? ORDER BY step, field_key`)
      .bind(id).all<ReviewAnswer>(),
    db.prepare("SELECT summary_json FROM sunday_review_health_snapshot WHERE session_id = ?")
      .bind(id).first<{ summary_json: string }>()
  ]);
  return {
    ...row,
    task_references: references.results.map(({ item_id }) => item_id),
    steps: steps.results,
    answers: answers.results,
    health_context: health ? JSON.parse(health.summary_json) as WeeklyHealthSummary : null
  };
}

export async function refreshReviewHealthContext(db: D1Database, id: string): Promise<ReviewSession> {
  const row = await assertEditable(db, id);
  const rangeStart = addDays(row.week_start, -7);
  const summary = await readWeeklyHealthSummary(db, rangeStart, row.timezone);
  await db.prepare(`INSERT INTO sunday_review_health_snapshot
    (session_id, range_start, range_end, timezone, retrieved_at, summary_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      range_start = excluded.range_start, range_end = excluded.range_end,
      timezone = excluded.timezone, retrieved_at = excluded.retrieved_at,
      summary_json = excluded.summary_json
  `).bind(id, summary.week_start, summary.week_end, summary.timezone, summary.retrieved_at, JSON.stringify(summary)).run();
  return getReviewSession(db, id);
}

export async function findActiveReviewSession(
  db: D1Database,
  weekStart: string,
  weekEnd: string,
  timezone: string
): Promise<ReviewSession | null> {
  validateWeek(weekStart, weekEnd, timezone);
  const row = await db.prepare(`SELECT id FROM sunday_review_session
    WHERE week_start = ? AND week_end = ? AND timezone = ?
      AND status IN ('not_started', 'in_progress', 'ready_for_packet')
    ORDER BY created_at DESC LIMIT 1`).bind(weekStart, weekEnd, timezone).first<{ id: string }>();
  return row ? getReviewSession(db, row.id) : null;
}

async function createSession(
  db: D1Database,
  weekStart: string,
  weekEnd: string,
  timezone: string,
  restartedFromId: string | null = null,
  prefixStatements: D1PreparedStatement[] = []
): Promise<ReviewSession> {
  validateWeek(weekStart, weekEnd, timezone);
  const active = await findActiveReviewSession(db, weekStart, weekEnd, timezone);
  if (active && active.id !== restartedFromId) {
    throw new ReviewSessionError("conflict", "an active review session already exists for this week");
  }

  const tasks = await readCanonicalTasks(db);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = [
    ...prefixStatements,
    db.prepare(`INSERT INTO sunday_review_session
      (id, week_start, week_end, timezone, status, current_step, task_retrieved_at,
       restarted_from_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'in_progress', 1, ?, ?, ?, ?)`
    ).bind(id, weekStart, weekEnd, timezone, now, restartedFromId, now, now),
    db.prepare(`INSERT INTO sunday_review_step_state (session_id, step, state, updated_at)
      VALUES (?, 2, 'completed', ?)`
    ).bind(id, now)
  ];
  for (const task of tasks) {
    statements.push(db.prepare("INSERT INTO sunday_review_task_reference (session_id, item_id) VALUES (?, ?)")
      .bind(id, task.id));
  }
  await db.batch(statements);
  return refreshReviewHealthContext(db, id);
}

export async function startReviewSession(
  db: D1Database,
  input: { week_start: string; week_end: string; timezone: string }
): Promise<ReviewSession> {
  return createSession(db, input.week_start, input.week_end, input.timezone);
}

export async function saveReviewAnswer(
  db: D1Database,
  sessionId: string,
  input: {
    step: number;
    field_key: string;
    response_kind: ReviewResponseKind;
    input_kind?: ReviewInputKind;
    raw_input?: string | null;
  }
): Promise<ReviewSession> {
  validateStep(input.step);
  validateFieldKey(input.field_key);
  await assertEditable(db, sessionId);
  const responseKinds = new Set<ReviewResponseKind>(["answered", "none", "not_applicable", "unknown", "skipped", "deferred"]);
  const inputKinds = new Set<ReviewInputKind>(["typed", "pasted", "uploaded_summary"]);
  const inputKind = input.input_kind ?? "typed";
  if (!responseKinds.has(input.response_kind) || !inputKinds.has(inputKind)) {
    throw new ReviewSessionError("invalid_request", "invalid response_kind or input_kind");
  }
  if (input.response_kind === "answered" && typeof input.raw_input !== "string") {
    throw new ReviewSessionError("invalid_request", "answered responses require raw_input");
  }
  if (input.raw_input !== undefined && input.raw_input !== null && typeof input.raw_input !== "string") {
    throw new ReviewSessionError("invalid_request", "raw_input must be a string or null");
  }

  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO sunday_review_answer
    (session_id, step, field_key, response_kind, input_kind, raw_input, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id, step, field_key) DO UPDATE SET
      response_kind = excluded.response_kind,
      input_kind = excluded.input_kind,
      raw_input = excluded.raw_input,
      updated_at = excluded.updated_at`
  ).bind(sessionId, input.step, input.field_key, input.response_kind, inputKind, input.raw_input ?? null, now, now).run();
  await db.prepare("UPDATE sunday_review_session SET updated_at = ? WHERE id = ?").bind(now, sessionId).run();
  return getReviewSession(db, sessionId);
}

export async function setReviewStepState(
  db: D1Database,
  sessionId: string,
  step: number,
  state: ReviewStepState
): Promise<ReviewSession> {
  validateStep(step);
  await assertEditable(db, sessionId);
  if (!new Set<ReviewStepState>(["completed", "skipped"]).has(state)) {
    throw new ReviewSessionError("invalid_request", "state must be completed or skipped");
  }
  if (AUTOMATIC_STEPS.has(step) && state === "skipped") {
    throw new ReviewSessionError("invalid_request", "automatic task loading cannot be skipped");
  }

  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO sunday_review_step_state (session_id, step, state, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(session_id, step) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`
  ).bind(sessionId, step, state, now).run();

  const completed = await db.prepare("SELECT step FROM sunday_review_step_state WHERE session_id = ?")
    .bind(sessionId).all<{ step: number }>();
  const completedSteps = new Set(completed.results.map(({ step: completedStep }) => completedStep));
  const nextStep = COLLECTION_STEPS.find(candidate => !completedSteps.has(candidate));
  const status: ReviewSessionStatus = nextStep === undefined ? "ready_for_packet" : "in_progress";
  await db.prepare("UPDATE sunday_review_session SET status = ?, current_step = ?, updated_at = ? WHERE id = ?")
    .bind(status, nextStep ?? 14, now, sessionId).run();
  return getReviewSession(db, sessionId);
}

export async function transitionReviewSession(
  db: D1Database,
  sessionId: string,
  action: "complete" | "abandon" | "archive" | "restart"
): Promise<ReviewSession> {
  const row = await sessionRow(db, sessionId);
  const now = new Date().toISOString();
  if (action === "restart") {
    if (!ACTIVE_STATUSES.has(row.status)) {
      throw new ReviewSessionError("conflict", `cannot restart a ${row.status} review session`);
    }
    const replacement = await createSession(
      db,
      row.week_start,
      row.week_end,
      row.timezone,
      sessionId,
      [db.prepare(`UPDATE sunday_review_session
        SET status = 'abandoned', abandoned_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, sessionId)]
    );
    return replacement;
  }
  if (action === "complete") {
    if (!ACTIVE_STATUSES.has(row.status)) throw new ReviewSessionError("conflict", `cannot complete a ${row.status} review session`);
    await db.prepare(`UPDATE sunday_review_session
      SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`
    ).bind(now, now, sessionId).run();
  } else if (action === "abandon") {
    if (!ACTIVE_STATUSES.has(row.status)) throw new ReviewSessionError("conflict", `cannot abandon a ${row.status} review session`);
    await db.prepare(`UPDATE sunday_review_session
      SET status = 'abandoned', abandoned_at = ?, updated_at = ? WHERE id = ?`
    ).bind(now, now, sessionId).run();
  } else if (action === "archive") {
    if (row.status === "archived") throw new ReviewSessionError("conflict", "review session is already archived");
    await db.prepare(`UPDATE sunday_review_session
      SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?`
    ).bind(now, now, sessionId).run();
  } else {
    throw new ReviewSessionError("invalid_request", "invalid review session action");
  }
  return getReviewSession(db, sessionId);
}
