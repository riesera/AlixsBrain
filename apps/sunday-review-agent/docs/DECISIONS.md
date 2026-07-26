# Decision Log

## How to Use This File

This is a living product and architecture decision log. Add a new entry when a decision changes boundaries, data ownership, autonomy, user experience, safety, or technical direction.

Statuses:

- **Accepted** — current direction.
- **Proposed** — recommended but not yet confirmed.
- **Deferred** — intentionally left open until more information is available.
- **Superseded** — replaced by a later decision.
- **Rejected** — considered and not chosen.

A decision should not be silently edited after implementation begins. When direction changes materially, add a new entry and mark the earlier entry superseded.

---

## D-001 — Sunday Review Is a Distinct Project and Agent

**Status:** Accepted

### Decision

The Sunday Review Agent is its own substantial product boundary within Alix's External Brain. It is not merely a Telegram command or a generic checklist.

### Rationale

The workflow will eventually coordinate task, project, calendar, health, learning, family, household, business, reflection, and specialized-agent context. It has a distinct mission, lifecycle, state, output, and future approval boundaries.

### Implications

- It receives its own documentation and roadmap.
- Its core workflow should be reusable across interfaces.
- It may still share a repository or infrastructure with other External Brain components.

### Alternatives Considered

- Implement it as a Telegram command inside the current task bot.
- Treat it as a static weekly checklist template.

### Reconsideration Conditions

Reconsider only if implementation inspection shows the workflow is genuinely trivial and has no independent state or evolution. Current requirements make that unlikely.

---

## D-002 — The External Brain Owns Shared Data and Infrastructure

**Status:** Accepted

### Decision

Shared data models and shared infrastructure belong conceptually to Alix's External Brain, not to the Sunday Review Agent.

### Rationale

The same task, project, calendar, health, and goal information will eventually serve multiple specialized agents and interfaces. Assigning shared data to one specialized agent would create duplication and coupling.

### Implications

- Sunday Review consumes shared data through defined boundaries.
- Data that should serve multiple agents should not be trapped in review-specific structures.
- The eventual parent brain may orchestrate Sunday Review.

### Alternatives Considered

- Make Sunday Review the owner of all weekly-planning-related data.
- Copy shared data into a Sunday Review-specific store.

### Reconsideration Conditions

Reconsider individual data ownership only when a field is proven to be exclusively review-session context rather than shared domain data.

---

## D-003 — The Existing Task System Remains Canonical

**Status:** Accepted

### Decision

The existing Cloudflare-backed task system remains the canonical source of to-do data.

### Rationale

A working task-ingestion and portable to-do system already exists. Creating another source of truth would increase inconsistency, synchronization work, and cognitive burden.

### Implications

- Sunday Review reads task data from the existing system.
- V0.1 must preserve source references and original wording.
- Task corrections belong in the canonical system, not only in the review packet.

### Alternatives Considered

- Migrate tasks into a new Sunday Review database.
- Maintain synchronized task copies in both systems.

### Reconsideration Conditions

Reconsider only as part of a deliberate External Brain-wide task-system migration, never as a Sunday Review convenience.

---

## D-004 — Sunday Review Will Not Create a Duplicate Canonical Task Database

**Status:** Accepted

### Decision

Sunday Review may retain task references, a review-time snapshot, or source excerpts needed for reproducibility, but it will not create a competing canonical task database.

### Rationale

Resumability and historical packets may require review-owned state. That state must not become an editable shadow task system.

### Implications

- Any stored task snapshot is historical review context.
- Source task IDs must remain traceable.
- Future task changes require an approved write to the canonical task system.
- Review packets may become stale relative to current tasks and should show their retrieval time.

### Alternatives Considered

- Store a full editable task copy for convenience.
- Avoid all task snapshots and rely only on live reads.

### Reconsideration Conditions

Reconsider snapshot detail and retention after inspecting task-history support, but do not reconsider the no-competing-canonical-store principle without an External Brain-wide migration decision.

---

## D-005 — The Workflow Is Interface-Independent

**Status:** Accepted

### Decision

Telegram may trigger, collect, or display the review, but Telegram does not own Sunday Review logic or essential state.

### Rationale

The same workflow should eventually be usable from a dashboard or parent External Brain. Coupling logic to Telegram message handling would make reuse and testing difficult.

### Implications

- Telegram should be treated as an adapter.
- Workflow state must not exist only in chat history.
- Core steps and packet generation should be callable from another interface.

### Alternatives Considered

- Build all review logic directly into Telegram handlers.
- Delay interface independence until a dashboard exists.

### Reconsideration Conditions

The interface may change, but core workflow ownership should remain independent unless the project is intentionally abandoned as a reusable agent.

---

## D-006 — V0.1 Is Guided and Non-Autonomous

**Status:** Accepted

### Decision

V0.1 gathers, organizes, and preserves context through a guided review. It does not independently decide the week's priorities or schedule.

### Rationale

The immediate problem is the effort required to gather and reconstruct context. Autonomous planning adds risk and complexity before the input foundation is trustworthy.

### Implications

- V0.1 may use deterministic logic and may not need an AI model.
- Final prioritization happens collaboratively after packet generation.
- The review should collect decisions without pretending to make them.

### Alternatives Considered

- Start with an AI planner that generates a full schedule.
- Produce only a static task summary with no guided review.

### Reconsideration Conditions

Advance autonomy only after the packet is reliable, real reviews demonstrate value, and recommendation behavior can be evaluated.

---

## D-007 — V0.1 Outputs a Markdown Sunday Planning Packet for ChatGPT

**Status:** Accepted

### Decision

The primary V0.1 output is a structured Markdown packet that Alix can paste into ChatGPT for collaborative planning.

### Rationale

This provides immediate value without building a full planning engine or direct ChatGPT integration. Markdown is readable, portable, inspectable, and provider-neutral.

### Implications

- Packet structure and provenance labels are part of the V0.1 contract.
- The packet must contain enough context to work in a fresh ChatGPT conversation.
- Export should not depend on Telegram formatting.

### Alternatives Considered

- Generate a proprietary JSON-only payload.
- Integrate directly with one model provider in V0.1.
- Produce only an on-screen checklist.

### Reconsideration Conditions

Additional formats may be added later. Markdown should remain supported while it continues to serve as a transparent, portable representation.

---

## D-008 — Preserve Raw Source Input

**Status:** Accepted

### Decision

Original task wording and raw manual or pasted input should be preserved alongside normalized summaries.

### Rationale

Normalization can remove nuance or introduce interpretation. The source must remain available for trust, correction, and future regeneration.

### Implications

- The data model must distinguish raw input from derived summaries.
- Packet generation may quote or reference raw input selectively.
- Privacy and retention rules for raw manual input must be decided before implementation.

### Alternatives Considered

- Store only normalized fields.
- Discard manual input after packet generation.

### Reconsideration Conditions

Retention duration and storage detail may change for privacy or cost, but the workflow must preserve source context long enough to support review, correction, and trustworthy output.

---

## D-009 — Provenance and Uncertainty Must Remain Visible

**Status:** Accepted

### Decision

The system must visibly distinguish source facts, manual input, generated flags, uncertain interpretations, and missing information.

### Rationale

The review will combine multiple sources with uneven completeness. Without provenance, a generated interpretation can easily be mistaken for a source fact.

### Implications

- V0.1 output uses explicit labels or equivalent structured metadata.
- Derived categories must state their rule.
- Missing fields are not silently filled.
- Future AI recommendations must show their basis.

### Alternatives Considered

- Present one polished narrative without source labels.
- Expose provenance only in logs or debug views.

### Reconsideration Conditions

The visual syntax may change if a better interface exists, but the underlying distinctions must remain.

---

## D-010 — No External Action Without Approval

**Status:** Accepted

### Decision

The agent must not create, change, or delete external records without explicit approval appropriate to the action.

### Rationale

Task dates, calendar blocks, workouts, reminders, and shared project state can create real obligations and consequences. Read access does not imply write permission.

### Implications

- V0.1 is read-only with respect to shared systems.
- Future actions require preview, approval, audit, and failure reporting.
- Consent cannot be assumed from a prior week or a broad integration authorization.

### Alternatives Considered

- Allow low-risk automatic updates.
- Treat packet approval as blanket approval for all writes.

### Reconsideration Conditions

Specific standing approvals may be considered only after granular scope, revocation, auditability, and user trust are established. The general approval boundary remains.

---

## D-011 — Technology and Packaging Choices Remain Open Until Inspection

**Status:** Accepted

### Decision

Do not commit yet to a model, provider, agent framework, repository layout, runtime, deployment platform, or Sunday Review persistence product.

### Rationale

The current task-system architecture has not been inspected. Premature choices could duplicate infrastructure, create avoidable coupling, or conflict with existing security and deployment patterns.

### Implications

- Documentation describes conceptual boundaries first.
- The first implementation-planning session must inspect the codebase.
- Architecture decisions should cite verified constraints.

### Alternatives Considered

- Create a new standalone repository immediately.
- Place the workflow directly inside the existing Telegram bot.
- select a model and framework before defining V0.1.

### Reconsideration Conditions

This decision is expected to be superseded by specific architecture decisions after inspection.

---

## D-012 — Review-Session State Is Sunday Review-Owned Workflow Data

**Status:** Accepted at the product boundary; implementation deferred

### Decision

The Sunday Review Agent may own the state required to start, pause, resume, regenerate, archive, or abandon a weekly review. This state is separate from canonical task data.

### Rationale

Resumability is a V0.1 requirement. The workflow needs to remember completed steps, raw manual input, the relevant week, task source references or snapshot, and packet-generation status.

### Implications

- A persistence mechanism is required for V0.1B.
- The exact storage technology remains undecided.
- Review state must clearly identify retrieval times and source references.
- Editing review state must not silently edit canonical tasks.

### Alternatives Considered

- Store all state only in Telegram conversation history.
- Require every review to finish in one session.
- Store review answers inside the canonical task database.

### Reconsideration Conditions

The data model and storage location may change after inspecting shared infrastructure. Ownership should change only if a parent External Brain establishes a general workflow-session service.

---

## D-013 — Standing Roles Are Prompts, Not Weekly Quotas

**Status:** Accepted

### Decision

The review considers standing roles so important areas are not forgotten, but it does not require every role to be active or to have a goal every week.

### Rationale

Forcing goals across all roles would recreate the overload the project is meant to reduce.

### Implications

- Roles support active, maintenance-only, waiting, paused, inactive, and backlog states.
- Active roles should usually have one or two realistic outcomes.
- Minimum acceptable progress may replace an ambitious goal.

### Alternatives Considered

- Require at least one goal for every role.
- Ignore roles and review only tasks.

### Reconsideration Conditions

Role vocabulary and defaults may evolve based on actual use. The no-quota principle remains.

---

## D-014 — “No Project Left Behind” Means Deliberate Visibility

**Status:** Accepted

### Decision

Projects should remain visible and receive a deliberate status, but they do not all need active work in the current week.

### Rationale

The intent is to prevent forgotten or indefinitely stale projects, not to activate more work than the week can support.

### Implications

- Waiting, paused, maintenance-only, inactive, and backlog are legitimate project states.
- A visible project without weekly work is not automatically a failure.
- Future stale-project flags should prompt a decision, not automatic activation.

### Alternatives Considered

- Require progress on every active portfolio item every week.
- Hide projects that are not selected for the week.

### Reconsideration Conditions

Project-state definitions may change, but visibility must remain separable from weekly activation.

---

## D-015 — Health Connect Data Is Shared Input with Compacted Retention

**Status:** Accepted

### Decision

Health Connect integration and canonical health summaries belong to shared External Brain infrastructure. A read-only Android companion app will synchronize selected device-local Health Connect data into that shared layer. Sunday Review will consume dated summaries for its Health and Capacity step rather than owning a separate health database or requiring repeated manual exports.

The initial shared dataset may include steps, sleep, exercise sessions, food and nutrition with available micronutrients, hydration, weight, and resting heart rate. Event-level detail is retained for 90 days, then deterministically compacted into daily, weekly, and monthly history according to the retention policy in the External Brain decision log. Medical records and exercise routes/GPS are excluded initially.

Only current nutrition and hydration targets are retained. Sunday Review must not claim historical target attainment when historical targets were not stored. Any comparison between old observations and a current target must be labeled as using the current target.

### Rationale

Manual Health Connect exports contain years of data and create excessive repeated work. Direct Worker access is not possible because Health Connect is device-local. A small Android sync client removes the export burden, while compaction keeps long-term trends useful without retaining unnecessary sensitive detail.

### Implications

- Health Connect synchronization is a future shared integration, not review-session persistence.
- Sunday Review may snapshot or reference a retrieved weekly summary with its retrieval time and source coverage.
- Step 8 should prefill supported measurements and continue to ask manually about subjective energy, stress, pain, illness, recovery, capacity, and realistic minimums.
- Missing nutrition or hydration logging is not equivalent to consuming zero.
- Micronutrients are stored sparsely; absent source values remain missing.
- Health summaries and later interpretations must remain non-diagnostic.
- Compaction must be deterministic, retry-safe, auditable, and verified before detailed records are deleted.

### Alternatives Considered

- Manually download and upload the full Health Connect export for every review.
- Retain every raw Health Connect record indefinitely.
- Store health records inside Sunday Review session tables.
- Keep only a lifetime average with no recent or time-bounded trends.
- Retain historical versions of nutrition and hydration targets.

### Reconsideration Conditions

Revisit individual metric selection, compaction windows, and summary resolution after measuring actual source coverage, record volume, and usefulness in real reviews. The shared-data ownership boundary and truthful handling of missing data should remain unless superseded by an External Brain-wide health architecture decision.

---

## D-016 — Sunday Review Consumes Canonical Daily Health Summaries

**Status:** Accepted

### Decision

The initial shared Health Connect integration stores one retry-safe summary per device, local date, and timezone. Sunday Review will later read dated weekly views derived from those shared daily summaries; it will not receive numeric exercise codes, device credentials, or a duplicate health store. Missing measurements remain null, micronutrients remain sparse, and exercise categories use friendly canonical names.

### Rationale

Daily summaries are sufficient to prefill the weekly Health and Capacity prompt while preserving coverage and correction behavior. They also keep the Sunday Review boundary independent from Android and Health Connect implementation details.

### Implications

- Repeated phone backfills correct the same dated summary rather than creating duplicates.
- A dedicated revocable device token authenticates ingestion and is never exposed to Sunday Review.
- The packet must distinguish logged food energy from total energy burned and must expose logging coverage before interpreting energy balance.
- Background sync, event-detail retention, compaction, and packet generation remain separate milestones.

### Reconsideration Conditions

Revisit the daily contract if real source data cannot represent corrections, time-zone transitions, or the coverage needed for trustworthy weekly interpretation.
