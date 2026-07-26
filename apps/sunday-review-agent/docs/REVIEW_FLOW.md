# V0.1 Review Flow and Packet Contract

## Why This File Exists

The five core documents define mission, status, roadmap, and decisions. This file isolates the operational contract for the first usable review so future IDE or coding agents do not have to reconstruct the workflow from several documents.

It covers:

- the V0.1 session lifecycle;
- task-data expectations;
- required versus optional fields;
- manual input behavior;
- skip logic and question rules;
- provenance labels;
- resumability;
- the Sunday Planning Packet structure;
- V0.1 acceptance checks.

This is a product contract, not an implementation design. Storage, APIs, frameworks, and interfaces remain open.

## V0.1 Outcome

At the end of a completed review, the system produces a structured Markdown packet containing the known context needed for Alix and ChatGPT to collaboratively prioritize and schedule the upcoming week.

V0.1 does not independently produce the approved weekly plan.

## Core Session Concepts

A review session should conceptually contain:

- a unique review-session reference;
- the target week and date range;
- session status;
- created, updated, and completed timestamps;
- the source-task retrieval time;
- task source references or a historical task snapshot sufficient for packet reproducibility;
- the current workflow step;
- completed and skipped steps;
- raw manual or pasted input;
- normalized review fields, if used;
- generated flags and their rules;
- unresolved questions;
- packet generation status and output reference.

The exact storage representation is deferred.

### Suggested Session Statuses

- **not_started** — a week exists but the review has not begun;
- **in_progress** — at least one step is complete;
- **ready_for_packet** — required collection steps are complete or deliberately skipped;
- **packet_generated** — at least one packet has been generated;
- **completed** — Alix marks the review complete;
- **abandoned** — the session is intentionally closed without completion;
- **archived** — retained for history and not active.

Names may change during design, but resumability and explicit abandonment should remain.

## Week Definition

The session must store an explicit start date, end date, and timezone. It must not rely only on words such as “this week” or “next week.”

The default week boundary is unresolved and must be confirmed during implementation planning.

## Task-System Input Contract

### Principle

The Sunday Review Agent reads canonical task data. It does not repair or enrich the canonical record by silently inventing values.

Every source field should support three distinct states where applicable:

1. **present with a value**;
2. **explicitly empty or null** — for example, a task intentionally has no due date;
3. **unavailable or unsupported** — the source system does not expose the field.

This distinction is essential. “Undated” is not the same as “due date unknown because the field is unavailable.”

### Required V0.1 Task Fields

These are the minimum fields needed for a trustworthy read-only task snapshot:

| Field | Requirement | Purpose |
|---|---|---|
| Stable source reference | Required | Trace the review item back to the canonical task. A task ID is preferred; another stable reference may be accepted after inspection. |
| Original task wording | Required | Preserve the canonical wording without normalization loss. |
| Completion state | Required | Determine whether the task belongs in the open-task review. |
| Source system | Required | Identify the canonical origin. |
| Retrieval timestamp | Required at snapshot level | Show when the review data was read. |

If these cannot be retrieved reliably, V0.1A is blocked and the task-system interface must be improved first.

### Useful but Optional V0.1 Task Fields

The workflow should use these when available and visibly mark them when unavailable:

| Field | Use in Review |
|---|---|
| Due date and due time | Overdue, due-this-week, and undated groupings. |
| Timezone | Correct due-date interpretation. |
| Domain | Tasks by domain and domain-aware questions. |
| Project association | Active-project summaries and related-task grouping. |
| Owner | Separate Alix-owned, Dan-owned, delegated, or shared work. |
| Status | Distinguish actionable, waiting, blocked, scheduled, or other source states. |
| Priority | Preserve existing priority without treating it as final weekly priority. |
| Waiting-on person or category | Waiting on Dan, team, customer, vendor, or outside condition. |
| Created timestamp | Age and staleness context. |
| Updated timestamp | Change awareness and stale-record checks. |
| Source or ingestion metadata | Trace whether the task came from Telegram, manual entry, email, or another source. |
| Carry-forward count or history | Repeated unfinished-task review. |
| Notes or context | Preserve useful source detail. |

### Future Task-System Improvements

These fields may eventually belong in shared External Brain task or project infrastructure. They are not requirements for the first read-only snapshot:

- explicit review decision and reason;
- defer-until date;
- paused or dropped status with reason;
- delegation history;
- blocker and blocker owner;
- next-action quality flag;
- effort estimate;
- expected duration;
- energy or cognitive-load category;
- urgency source;
- project outcome association;
- weekly activation state;
- task recurrence and completion history;
- stable carry-forward count;
- last reviewed date;
- “not this week” status;
- relationship to long-term goals.

The Sunday Review Agent may collect some of these as session decisions before a shared write model exists. Session-local collection must not be mistaken for a canonical update.

## Derived Task Views in V0.1

The system should attempt to produce:

- all incomplete tasks;
- overdue tasks;
- tasks due during the target week;
- explicitly undated tasks;
- tasks grouped by actual source domain;
- tasks grouped by actual source project;
- tasks waiting on Dan;
- tasks waiting on someone else;
- repeatedly carried-forward tasks;
- tasks with missing metadata.

A view should be omitted or marked unsupported when its required source data does not exist.

### Generated Flags

A generated flag is allowed when:

- its rule is deterministic and documented;
- the required source fields are available;
- the output is labeled as generated rather than source-authored;
- the user can see or understand the basis.

Examples:

- “Overdue” derived from due date, completion state, target timezone, and retrieval time.
- “Due this week” derived from the stored target-week boundaries.
- “Missing project” derived from an unavailable or empty project field.

A generated flag must not claim:

- that a task is urgent merely because it is old;
- that a person owns a task based only on wording;
- that a task is waiting on Dan without supporting metadata or an explicitly labeled interpretation;
- that an undated task is low priority;
- that repeated carry-forward occurred when no reliable history exists.

## Manual Input Contract

### Accepted Forms

V0.1 should allow:

- direct typed answers;
- pasted summaries;
- uploaded text or document summaries, if the chosen interface can support them without expanding scope excessively;
- explicit “none,” “not applicable,” “unknown,” and “skip for now” responses.

### Raw and Normalized Input

Raw input should be retained. The system may also store normalized fields for packet generation, but normalized values must remain linked to the raw source.

Example:

- Raw input: “Thursday is basically shot because of the install and drive.”
- Normalized fields: Thursday; low availability; install; travel/preparation constraint.
- Provenance: manual input.
- Interpretation note: “basically shot” converted to low availability; confirm if it materially affects scheduling.

### Question Rules

The guided review should:

- ask only for information not already available;
- ask one manageable question or small related group at a time;
- use progressive disclosure;
- skip inactive domains;
- avoid asking for exact metrics when an approximate answer is sufficient;
- allow edits to earlier answers;
- avoid requiring every standing role to produce a goal;
- explain why a sensitive or burdensome question matters;
- allow the packet to proceed with visible gaps when a missing answer is nonessential.

## V0.1 Review Lifecycle

### Step 0 — Start or Resume

The workflow should:

- find an existing in-progress session for the target week;
- offer resume, restart, archive, or create new as appropriate;
- show the target date range and retrieval status;
- avoid overwriting prior work without an explicit choice.

### Step 1 — Establish the Week

Collect or confirm:

- target start and end dates;
- timezone;
- kid-week status, if relevant and not available;
- unusual circumstances;
- expected overall capacity in plain language.

### Step 2 — Load and Validate Task Data

The workflow should:

- read incomplete tasks;
- record retrieval time;
- validate required fields;
- produce basic counts and groups;
- show unsupported views and missing metadata;
- stop with a clear error if canonical tasks cannot be read reliably.

This step must not return an empty task list as if it were valid when retrieval failed.

### Step 3 — Review Fixed Commitments

Collect or confirm:

- appointments;
- meetings;
- office days;
- installs;
- kid obligations;
- travel;
- deadlines;
- preparation and travel time;
- unusually busy or unavailable days.

Until calendar integration exists, this step is manual or pasted.

### Step 4 — Review Urgent and Administrative Work

Prompt for context not already represented by tasks:

- customer issues;
- vendor issues;
- procurement and shipping;
- finance and administration;
- scheduling;
- sales follow-up;
- anything likely to become a problem during the week.

The workflow should not label work urgent solely because it appears in this section. Urgency remains source-provided, manually stated, or a labeled planning flag.

### Step 5 — Review Projects

For projects represented in task data or manually named, collect as needed:

- project name;
- domain;
- current state;
- next action;
- blocker;
- blocker owner;
- related open tasks;
- desired weekly outcome;
- proposed weekly state: active, maintenance-only, waiting, paused, inactive, or backlog.

The workflow should not force a desired outcome for paused, waiting, inactive, or backlog projects.

### Step 6 — Review Waiting-On Items

Separate known or manually identified items into:

- waiting on Dan;
- waiting on team members;
- waiting on customers;
- waiting on vendors;
- waiting on outside conditions;
- waiting category unknown.

Ask whether a follow-up or decision is needed only when the answer matters for the coming week.

### Step 7 — Review Carry-Forward Items

When reliable history exists, show repeatedly unfinished items and collect a deliberate disposition:

- schedule;
- delegate;
- break down;
- pause;
- drop;
- discuss;
- keep visible with no action;
- unresolved.

When reliable history does not exist, mark carry-forward analysis unsupported rather than guessing from task age alone.

### Step 8 — Review Health and Capacity

Collect only useful planning context, such as:

- workouts completed and type;
- activity or steps;
- sleep quality;
- approximate protein and water adherence;
- stress;
- energy;
- pain, illness, or recovery limits;
- current fitness goals or skill practice;
- realistic health minimums for the coming week.

The workflow should accept approximate descriptions and must not diagnose.

### Step 9 — Review Learning

Collect active learning context, such as:

- Spanish, Rosetta Stone, Dreaming Spanish, or workbook progress;
- books or courses being studied;
- chapters completed;
- quizzes, assignments, or tests;
- business and technical learning;
- software projects;
- relevant topics encountered during work;
- next study action;
- realistic commitment for the week.

Inactive learning areas should be skipped without penalty.

### Step 10 — Review Home, Family, Dogs, and Restoration

Collect relevant context for:

- cleaning, organization, maintenance, and errands;
- kids and family obligations;
- Dan coordination;
- Rez and Billie health, supplies, grooming, training, or monitoring;
- reading, baking, rest, pool/outdoor time, social activity, or creative interests;
- at least one thing that would make the week feel enjoyable, when Alix wants to include it.

This section should not frame restoration as optional leftover time.

### Step 11 — Activate Roles

Present standing roles as prompts, preferably prefilled from saved preferences when available.

For each role, allow:

- active;
- maintenance-only;
- waiting;
- paused;
- inactive;
- backlog.

For active roles, collect:

- one or two desired outcomes;
- minimum acceptable progress;
- protected time needed, if any.

The workflow should flag likely overloading when too many roles or outcomes are active, but V0.1 should label this as a generated flag and leave judgment to Alix and ChatGPT.

### Step 12 — Collect Candidate Decisions

Create visible lists for:

- decisions needed;
- candidate not-this-week items;
- candidate pause items;
- candidate drop items;
- potential high-brainpower work;
- potential low-brainpower work;
- unresolved questions.

These are candidates for later planning, not approved changes.

### Step 13 — Review Completeness

Before packet generation, show:

- completed sections;
- skipped sections;
- missing required inputs;
- optional gaps;
- unsupported automatic views;
- stale task-retrieval warning, if applicable;
- any interpretations awaiting confirmation.

The user may generate the packet with optional gaps.

### Step 14 — Generate and Regenerate Packet

The system should:

- generate valid Markdown;
- include the task retrieval time and target week;
- use stable section order;
- label provenance;
- preserve unresolved and missing information;
- support regeneration after edits;
- avoid external writes.

## Provenance Labels

V0.1 should use a clear convention. The exact visual design may change, but these categories are required:

- **`[SYSTEM FACT]`** — directly retrieved from a connected source.
- **`[MANUAL INPUT]`** — supplied by Alix during the review.
- **`[GENERATED FLAG]`** — produced by a documented rule or calculation.
- **`[INTERPRETATION — CONFIRMED]`** — a normalized interpretation Alix confirmed.
- **`[INTERPRETATION — UNCERTAIN]`** — a plausible interpretation not confirmed as fact.
- **`[MISSING]`** — information expected or useful but not available.
- **`[UNSUPPORTED]`** — the current source or version cannot provide the field or analysis.

A section may use compact legends rather than repeating long labels on every line, but the distinction must remain obvious in copied Markdown.

## Sunday Planning Packet Schema

The packet should use the following stable top-level order. Empty sections may be omitted only when the packet clearly records that they were not applicable or were skipped.

### 1. Packet Metadata

- target week dates;
- timezone;
- generated timestamp;
- task retrieval timestamp;
- review-session status;
- provenance legend;
- stale-data or partial-data warnings.

### 2. Planning Request for ChatGPT

A concise request to:

- prioritize the week;
- identify what to schedule;
- identify what to defer, delegate, pause, drop, or discuss;
- protect high-brainpower work;
- place low-brainpower work appropriately;
- establish realistic health minimums;
- create a practical schedule around fixed commitments;
- preserve final human judgment.

### 3. Week at a Glance

- upcoming date range;
- kid-week status;
- fixed commitments;
- unusual circumstances;
- major constraints;
- overall capacity.

### 4. Task-System Summary

- total open tasks;
- overdue count and list or reference;
- due-this-week count and list or reference;
- explicitly undated count;
- waiting-on count;
- carried-forward count when supported;
- missing or unsupported metadata.

### 5. Urgent and Administrative Work

- time-sensitive work;
- customer and vendor issues;
- procurement and shipping;
- finance and administration;
- scheduling;
- likely problems.

### 6. Active Projects

For each project:

- name;
- domain;
- current state;
- next action;
- blocker;
- blocker owner;
- related open tasks;
- desired weekly outcome;
- proposed weekly state.

### 7. Tasks by Domain

Use actual source domains. Include an “Unassigned or unavailable domain” group when needed.

### 8. Waiting On

Separate:

- Dan;
- team members;
- customers;
- vendors;
- outside conditions;
- unknown category.

### 9. Carry-Forward Review

For each supported repeated item, show the candidate disposition and any reason supplied.

### 10. Health and Capacity

- workouts;
- sleep;
- protein;
- water;
- stress;
- energy;
- pain, illness, or recovery limitations;
- fitness goals;
- realistic health minimums.

### 11. Learning Progress

- active learning areas;
- resources;
- current progress;
- next action;
- realistic commitment.

### 12. Home and Family

- household priorities;
- kid obligations;
- Dan coordination;
- family needs.

### 13. Dogs

Separate Rez and Billie where relevant:

- health;
- supplies;
- grooming;
- training;
- monitoring.

### 14. Personal Restoration

- reading;
- baking;
- rest;
- pool or outdoor time;
- social or creative activity;
- something that would make the week enjoyable.

### 15. Goals by Active Role

For each active or maintenance-only role:

- status;
- desired outcome;
- minimum acceptable progress;
- protected time needed.

### 16. Potential High-Brainpower Work

Candidate work requiring protected focus. Classification should be manual, source-provided, or explicitly labeled as interpretation.

### 17. Potential Low-Brainpower Work

Candidate work suitable for lower-energy periods. Classification should be manual, source-provided, or explicitly labeled as interpretation.

### 18. Decisions Needed

Questions or tradeoffs that must be resolved during planning.

### 19. Candidate Not This Week Items

Items proposed for deliberate deferral, without changing the canonical task system.

### 20. Candidate Pause or Drop Items

Separate pause and drop candidates and include reasons when known.

### 21. Missing Information and Uncertainty

Consolidated list of:

- missing fields;
- unsupported analyses;
- uncertain interpretations;
- skipped sections;
- stale source warnings.

### 22. Raw Task Appendix

For every task included in the snapshot, preserve at least:

- stable source reference;
- original wording;
- available source metadata;
- task retrieval time or snapshot reference.

The appendix should avoid presenting normalized summaries as replacements for original wording.

### 23. Raw Manual Input Appendix

Optional in the main packet, but raw manual inputs must remain retrievable. The packet may include them directly, link to them, or include selected excerpts, depending on privacy and readability decisions.

## Resumability Requirements

A resumable review must:

- persist after each meaningful answer or completed step;
- restore the target week and task retrieval context;
- restore raw and normalized answers;
- return to the first incomplete or explicitly selected step;
- avoid asking completed questions again by default;
- allow earlier answers to be revised;
- distinguish a new review from a restarted or duplicated review;
- prevent accidental overwrite of a completed historical packet;
- report when canonical task data has changed since the saved snapshot, if detectable.

## Error and Partial-Data Behavior

The workflow should prefer honest partial completion over misleading completeness.

### Task Source Unavailable

- show a retrieval error;
- do not claim there are zero open tasks;
- allow retry;
- optionally allow a clearly labeled manual task summary only if the product explicitly supports that fallback.

### Optional Source or Manual Section Missing

- mark missing or skipped;
- continue the review;
- include the gap in the packet.

### Stale Session

- show task retrieval time;
- allow refresh, continue with the saved snapshot, or create a new session;
- never silently mix a historical snapshot with newly retrieved task values.

### Packet Generation Failure

- preserve the session;
- report the failure;
- allow regeneration;
- do not require the review to be re-entered.

## V0.1 End-to-End Acceptance Checklist

A V0.1 release is usable only when all of the following are true:

- [ ] It reads actual incomplete tasks from the canonical Cloudflare-backed system.
- [ ] It preserves original task wording and a stable source reference.
- [ ] It records the task retrieval time.
- [ ] It distinguishes explicit null, missing, and unsupported fields.
- [ ] It produces only supported task groupings.
- [ ] It clearly labels generated flags.
- [ ] It can start, save, resume, restart, abandon, and complete a review session without editing canonical tasks.
- [ ] It asks only for context not already available.
- [ ] It allows sections and roles to be skipped or inactive.
- [ ] It preserves raw manual or pasted input.
- [ ] It supports the documented role states.
- [ ] It generates valid Markdown in the documented section order.
- [ ] It distinguishes system facts, manual input, generated flags, interpretations, missing data, and unsupported analysis.
- [ ] It includes a raw task appendix.
- [ ] It reports source failures instead of treating them as empty data.
- [ ] It performs no external write actions.
- [ ] The packet can be used in a fresh ChatGPT conversation without re-explaining the project's purpose.
