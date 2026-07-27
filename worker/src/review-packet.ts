import { getReviewSession, REVIEW_GUIDE, ReviewSessionError, type ReviewAnswer, type ReviewSession } from "./review-sessions";
import { readCanonicalTasksByIds, type CanonicalTask } from "./task-reader";

export interface ReviewPacket {
  id: string;
  session_id: string;
  version: number;
  generated_at: string;
  task_snapshot_at: string | null;
  markdown: string;
}

interface TaskSnapshotRow { item_id: string; retrieved_at: string; snapshot_kind: "initial" | "backfilled"; task_json: string; }

const inline = (value: string): string => value.replace(/\s+/g, " ").trim().replace(/([\\`*_[\]<>])/g, "\\$1");
const value = (input: number | null, suffix = "", digits = 0): string =>
  input === null ? "[MISSING]" : `${input.toFixed(digits)}${suffix}`;
const fence = (raw: string): string => {
  const longest = Math.max(0, ...[...raw.matchAll(/`+/g)].map(match => match[0].length));
  const marker = "`".repeat(Math.max(3, longest + 1));
  return `${marker}text\n${raw}\n${marker}`;
};

async function ensureTaskSnapshots(db: D1Database, session: ReviewSession): Promise<TaskSnapshotRow[]> {
  const existing = await db.prepare(`SELECT item_id, retrieved_at, snapshot_kind, task_json
    FROM sunday_review_task_snapshot WHERE session_id = ? ORDER BY item_id`)
    .bind(session.id).all<TaskSnapshotRow>();
  const present = new Set(existing.results.map(row => row.item_id));
  const missing = session.task_references.filter(id => !present.has(id));
  if (missing.length) {
    const now = new Date().toISOString();
    const tasks = await readCanonicalTasksByIds(db, missing);
    if (tasks.length) await db.batch(tasks.map(task => db.prepare(`INSERT OR IGNORE INTO sunday_review_task_snapshot
      (session_id, item_id, retrieved_at, snapshot_kind, task_json) VALUES (?, ?, ?, 'backfilled', ?)`)
      .bind(session.id, task.id, now, JSON.stringify(task))));
    return (await db.prepare(`SELECT item_id, retrieved_at, snapshot_kind, task_json
      FROM sunday_review_task_snapshot WHERE session_id = ? ORDER BY item_id`)
      .bind(session.id).all<TaskSnapshotRow>()).results;
  }
  return existing.results;
}

const answerFor = (session: ReviewSession, step: number, field: string): ReviewAnswer | undefined =>
  session.answers.find(answer => answer.step === step && answer.field_key === field);

function manual(session: ReviewSession, step: number, field: string): string {
  const answer = answerFor(session, step, field);
  if (!answer) {
    const skipped = session.steps.some(state => state.step === step && state.state === "skipped");
    return skipped ? "[MISSING] Section deliberately skipped." : "[MISSING] Not provided.";
  }
  if (answer.response_kind === "answered") return `[MANUAL INPUT]\n\n${answer.raw_input ?? ""}`;
  if (answer.response_kind === "none") return "[MANUAL INPUT] None.";
  if (answer.response_kind === "not_applicable") return "[MANUAL INPUT] Not applicable.";
  if (answer.response_kind === "unknown") return "[MISSING] Marked unknown during review.";
  if (answer.response_kind === "deferred") return "[MISSING] Deferred during review.";
  return "[MISSING] Skipped during review.";
}

const taskLine = (task: CanonicalTask): string => {
  const metadata = [task.status, task.primary_category, task.domain, task.project, task.due_at ? `due ${task.due_at}` : "undated"]
    .filter(Boolean).map(String).join(" · ");
  return `- [SYSTEM FACT] ${inline(task.raw_text)}  \n  Source ref: \`${task.id}\`; ${metadata}`;
};
const taskList = (tasks: CanonicalTask[]): string => tasks.length ? tasks.map(taskLine).join("\n") : "[SYSTEM FACT] None in the saved task snapshot.";

function localDate(instant: string, timezone: string): string | null {
  const date = new Date(instant);
  if (Number.isNaN(date.valueOf())) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function healthSection(session: ReviewSession): string {
  const summary = session.health_context;
  if (!summary) return `[MISSING] No verified Health Connect snapshot is attached.\n\n${manual(session, 8, "health_capacity")}`;
  const metrics = summary.metrics;
  const exercise = Object.entries(summary.exercises).length
    ? Object.entries(summary.exercises).map(([name, item]) => `  - ${name}: ${item.sessions} session(s), ${item.minutes} minutes`).join("\n")
    : "  - [MISSING] No exercise sessions returned.";
  const protein = summary.nutrients.Protein;
  return [
    `[SYSTEM FACT] Evidence range: ${summary.week_start} through ${summary.week_end} (${summary.timezone}); retrieved ${summary.retrieved_at}.`,
    `- Coverage: ${summary.coverage.stored_days}/7 stored days`,
    `- Steps: ${value(metrics.steps.total)} total; ${metrics.steps.coverage_days}/7 days`,
    `- Sleep: ${metrics.sleep_minutes.average_recorded_day === null ? "[MISSING]" : `${(metrics.sleep_minutes.average_recorded_day / 60).toFixed(1)} average hours per recorded day`}; ${metrics.sleep_minutes.coverage_days}/7 days`,
    `- Food energy consumed/logged: ${value(metrics.food_energy_kilocalories.total, " kcal")}; ${metrics.food_energy_kilocalories.coverage_days}/7 logged days`,
    `- Total energy burned (basal + active): ${value(metrics.energy_burned_kilocalories.total, " kcal")}; ${metrics.energy_burned_kilocalories.coverage_days}/7 days`,
    `- Energy balance: ${metrics.energy_balance_kilocalories === null ? "[MISSING] Not calculated without complete food and burned-energy coverage" : `${metrics.energy_balance_kilocalories.toFixed(0)} kcal (logged food minus total burned)`}`,
    `- Protein: ${protein ? `${protein.total.toFixed(1)} g across ${protein.coverage_days}/7 logged days` : "[MISSING]"}`,
    `- Water: ${value(metrics.water_milliliters.total, " mL")}; ${metrics.water_milliliters.coverage_days}/7 logged days`,
    `- Weight: ${value(metrics.weight_kilograms.average, " kg", 1)} average; ${metrics.weight_kilograms.coverage_days}/7 measured days`,
    `- Resting heart rate: ${value(metrics.resting_heart_rate_bpm.average, " bpm")}; ${metrics.resting_heart_rate_bpm.coverage_days}/7 measured days`,
    `- Exercise:\n${exercise}`,
    ...summary.warnings.map(warning => `- [MISSING] ${warning}`),
    "",
    manual(session, 8, "health_capacity")
  ].join("\n");
}

export async function generateReviewPacket(db: D1Database, sessionId: string, generatedAt = new Date().toISOString()): Promise<Omit<ReviewPacket, "id" | "version">> {
  const session = await getReviewSession(db, sessionId);
  if (!new Set(["ready_for_packet", "completed"]).has(session.status)) {
    throw new ReviewSessionError("conflict", "review must be ready_for_packet or completed before packet generation");
  }
  const snapshotRows = await ensureTaskSnapshots(db, session);
  const tasks = snapshotRows.map(row => JSON.parse(row.task_json) as CanonicalTask);
  const taskSnapshotAt = snapshotRows.length ? snapshotRows.map(row => row.retrieved_at).sort().at(-1)! : null;
  const unresolvedRefs = session.task_references.filter(id => !snapshotRows.some(row => row.item_id === id));
  const backfilled = snapshotRows.some(row => row.snapshot_kind === "backfilled");
  const overdue = tasks.filter(task => task.due_at && (localDate(task.due_at, session.timezone) ?? "9999") < session.week_start);
  const dueThisWeek = tasks.filter(task => {
    if (!task.due_at) return false;
    const date = localDate(task.due_at, session.timezone);
    return date !== null && date >= session.week_start && date <= session.week_end;
  });
  const undated = tasks.filter(task => task.due_at === null);
  const waiting = tasks.filter(task => task.status === "Waiting");
  const urgent = tasks.filter(task => task.flags.includes("Urgent") || task.flags.includes("Time-Sensitive") ||
    ["Procurement", "Admin & Finance", "Communication & Follow-Up", "Scheduling & Coordination", "Problems to Solve"].includes(task.primary_category ?? ""));
  const projects = new Map<string, CanonicalTask[]>();
  const domains = new Map<string, CanonicalTask[]>();
  for (const task of tasks) {
    const project = task.project ?? "Unassigned or unavailable project";
    projects.set(project, [...(projects.get(project) ?? []), task]);
    const domain = task.domain ?? "Unassigned or unavailable domain";
    domains.set(domain, [...(domains.get(domain) ?? []), task]);
  }
  const skipped = session.steps.filter(step => step.state === "skipped").map(step => REVIEW_GUIDE.find(item => item.step === step.step)?.title ?? `Step ${step.step}`);
  const missingDomain = tasks.filter(task => task.domain === null).length;
  const missingProject = tasks.filter(task => task.project === null).length;
  const warnings = [
    backfilled ? `[MISSING] Task fields for this older session were first snapshotted at packet generation (${taskSnapshotAt}); they may differ from values at session creation.` : null,
    unresolvedRefs.length ? `[MISSING] ${unresolvedRefs.length} saved task reference(s) no longer had readable canonical values when the snapshot was created.` : null,
    ...skipped.map(name => `[MISSING] Review section skipped: ${name}.`),
    `[UNSUPPORTED] Reliable carry-forward history is not available in V0.1.`,
    `[UNSUPPORTED] Raw candidate-decision text is not automatically parsed into high/low-brainpower, defer, pause, or drop classifications.`,
    ...(session.health_context?.warnings.map(warning => `[MISSING] Health: ${warning}`) ?? [])
  ].filter((item): item is string => item !== null);

  const projectText = [...projects.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, group]) =>
    `### ${inline(name)}\n\n${taskList(group)}`).join("\n\n") || "[SYSTEM FACT] No project groups in the saved task snapshot.";
  const domainText = [...domains.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, group]) =>
    `### ${inline(name)}\n\n${taskList(group)}`).join("\n\n") || "[SYSTEM FACT] No domain groups in the saved task snapshot.";
  const waitingGroups = ["Dan", "Team", "Customer", "Vendor", "Other"].map(owner => {
    const group = waiting.filter(task => owner === "Other"
      ? !new Set(["Dan", "Team", "Customer", "Vendor"]).has(task.requested_by ?? "")
      : task.requested_by === owner);
    return `### ${owner === "Other" ? "Outside conditions or unknown category" : owner}\n\n${taskList(group)}`;
  }).join("\n\n");
  const rawTasks = tasks.length ? tasks.map(task => [
    `### \`${task.id}\``, `[SYSTEM FACT] Source: ${task.source}; status: ${task.status}; retrieved: ${taskSnapshotAt ?? session.task_retrieved_at}`,
    "", fence(task.raw_text), "", `Available metadata: category=${task.primary_category ?? "null"}; domain=${task.domain ?? "null"}; requested_by=${task.requested_by ?? "null"}; project=${task.project ?? "null"}; due_at=${task.due_at ?? "null"}; flags=${task.flags.join(", ") || "none"}.`
  ].join("\n")).join("\n\n") : "[SYSTEM FACT] No tasks were referenced by this review.";
  const rawManual = REVIEW_GUIDE.flatMap(step => step.questions.map(question => ({ step, question, answer: answerFor(session, step.step, question.field_key) })))
    .map(({ step, question, answer }) => {
      const header = `### Step ${step.step}: ${step.title} — \`${question.field_key}\``;
      if (!answer) return `${header}\n\n${manual(session, step.step, question.field_key)}`;
      return `${header}\n\nResponse kind: \`${answer.response_kind}\`; input kind: \`${answer.input_kind}\`; saved: ${answer.updated_at}.\n\n${answer.raw_input === null ? manual(session, step.step, question.field_key) : fence(answer.raw_input)}`;
    }).join("\n\n");

  const markdown = `# Sunday Planning Packet

## 1. Packet Metadata

- [SYSTEM FACT] Target week: ${session.week_start} through ${session.week_end}
- [SYSTEM FACT] Timezone: ${session.timezone}
- [SYSTEM FACT] Generated: ${generatedAt}
- [SYSTEM FACT] Task reference retrieval: ${session.task_retrieved_at}
- [SYSTEM FACT] Frozen task snapshot: ${taskSnapshotAt ?? "No task rows in snapshot"}
- [SYSTEM FACT] Review status: ${session.status}
- [SYSTEM FACT] Review session: \`${session.id}\`

Provenance legend: \`[SYSTEM FACT]\` connected source; \`[MANUAL INPUT]\` supplied during review; \`[GENERATED FLAG]\` documented rule/calculation; \`[INTERPRETATION — CONFIRMED]\` user-confirmed interpretation; \`[INTERPRETATION — UNCERTAIN]\` unconfirmed interpretation; \`[MISSING]\` expected/useful but unavailable; \`[UNSUPPORTED]\` not provided by this version/source.

${warnings.length ? warnings.map(item => `- ${item}`).join("\n") : "- [SYSTEM FACT] No partial-data warnings were generated."}

## 2. Planning Request for ChatGPT

Use this packet to collaborate with me on a realistic plan for ${session.week_start} through ${session.week_end}. Help prioritize what matters, decide what to schedule, defer, delegate, pause, drop, or discuss, protect high-brainpower work, place low-brainpower work appropriately, establish realistic health minimums, and build a practical schedule around fixed commitments. Ask when evidence is missing or uncertain. Preserve my final judgment and do not make external changes.

## 3. Week at a Glance

### Week context, unusual circumstances, kid-week status, constraints, and capacity

${manual(session, 1, "week_context")}

### Fixed commitments

${manual(session, 3, "fixed_commitments")}

## 4. Task-System Summary

- [SYSTEM FACT] Reviewable tasks in frozen snapshot: ${tasks.length}
- [GENERATED FLAG] Overdue before ${session.week_start}: ${overdue.length}
- [GENERATED FLAG] Due during target week: ${dueThisWeek.length}
- [SYSTEM FACT] Explicitly undated: ${undated.length}
- [SYSTEM FACT] Waiting status: ${waiting.length}
- [UNSUPPORTED] Carried-forward count: reliable history unavailable
- [MISSING] Domain unavailable: ${missingDomain}; project unavailable: ${missingProject}

### Overdue

${taskList(overdue)}

### Due this week

${taskList(dueThisWeek)}

## 5. Urgent and Administrative Work

${taskList(urgent)}

${manual(session, 4, "urgent_admin_context")}

## 6. Active Projects

${projectText}

### Manual project context

${manual(session, 5, "project_context")}

## 7. Tasks by Domain

${domainText}

## 8. Waiting On

${waitingGroups}

### Manual dependency context

${manual(session, 6, "waiting_on")}

## 9. Carry-Forward Review

[UNSUPPORTED] Reliable task-history evidence is not available. No carry-forward status was inferred from task age.

${manual(session, 7, "carry_forward")}

## 10. Health and Capacity

${healthSection(session)}

## 11. Learning Progress

${manual(session, 9, "learning")}

## 12. Home and Family

${manual(session, 10, "home_family")}

## 13. Dogs

${manual(session, 10, "dogs")}

## 14. Personal Restoration

${manual(session, 10, "restoration")}

## 15. Goals by Active Role

${manual(session, 11, "roles")}

## 16. Potential High-Brainpower Work

[UNSUPPORTED] V0.1 does not parse raw candidate-decision input into a high-brainpower classification. Review Section 18 manually.

## 17. Potential Low-Brainpower Work

[UNSUPPORTED] V0.1 does not parse raw candidate-decision input into a low-brainpower classification. Review Section 18 manually.

## 18. Decisions Needed

${manual(session, 12, "candidate_decisions")}

## 19. Candidate Not This Week Items

[UNSUPPORTED] V0.1 does not infer deferral candidates. Use the manual decisions in Section 18.

## 20. Candidate Pause or Drop Items

[UNSUPPORTED] V0.1 does not infer pause or drop candidates. Use the manual decisions in Section 18.

## 21. Missing Information and Uncertainty

${warnings.map(item => `- ${item}`).join("\n") || "[SYSTEM FACT] No missing-information notices were generated."}

### Manual completeness check

${manual(session, 13, "completeness")}

## 22. Raw Task Appendix

${rawTasks}

## 23. Raw Manual Input Appendix

${rawManual}
`;
  return { session_id: session.id, generated_at: generatedAt, task_snapshot_at: taskSnapshotAt, markdown };
}

export async function createReviewPacket(db: D1Database, sessionId: string): Promise<ReviewPacket> {
  const generated = await generateReviewPacket(db, sessionId);
  const version = (await db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM sunday_review_packet WHERE session_id = ?")
    .bind(sessionId).first<number>("version")) ?? 1;
  const packet: ReviewPacket = { id: crypto.randomUUID(), version, ...generated };
  await db.prepare(`INSERT INTO sunday_review_packet
    (id, session_id, version, generated_at, task_snapshot_at, markdown) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(packet.id, packet.session_id, packet.version, packet.generated_at, packet.task_snapshot_at, packet.markdown).run();
  return packet;
}

export async function latestReviewPacket(db: D1Database, sessionId: string): Promise<ReviewPacket | null> {
  await getReviewSession(db, sessionId);
  return db.prepare(`SELECT id, session_id, version, generated_at, task_snapshot_at, markdown
    FROM sunday_review_packet WHERE session_id = ? ORDER BY version DESC LIMIT 1`)
    .bind(sessionId).first<ReviewPacket>();
}
