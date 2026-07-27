# Sunday Review Agent Roadmap

## Roadmap Principles

This roadmap is phased by user value, not by technology layer. Each version should be independently useful and should leave the project in a coherent state.

The roadmap intentionally avoids locking in:

- a model or AI provider;
- an agent framework;
- a repository or monorepo structure;
- a runtime or deployment platform;
- an interface;
- a persistence product for Sunday Review session state;
- a specific Cloudflare product beyond the known fact that canonical task data currently lives in Cloudflare-backed infrastructure.

Modules do not need to be “finished forever” before adjacent capabilities can advance. A simple read-only calendar integration, for example, can be useful before project intelligence is complete.

## Status Legend

- **Active** — current planning or implementation focus.
- **Next** — expected after the active milestone, subject to findings.
- **Later** — valuable but not required for the first usable workflow.
- **Speculative** — directional vision requiring evidence, trust, or additional infrastructure.

---

## Active: V0.0 — Documentation and Existing-System Inspection

### Goal

Create an internally consistent product foundation and inspect the current Cloudflare-backed task system before selecting architecture.

### Scope

- establish mission, boundaries, and non-goals;
- define the V0.1 review lifecycle and packet;
- document required, optional, and missing task data;
- inspect existing task storage, APIs, authentication, history, and Telegram boundaries;
- decide whether Sunday Review lives in the existing repository, a shared monorepo, or a separate repository;
- select the smallest persistence approach for resumable review sessions.

### Dependencies

- access to the current task-system codebase;
- access to the current Cloudflare data model and interfaces;
- understanding of existing authentication and deployment patterns.

### Acceptance Criteria

- the five core documents and `REVIEW_FLOW.md` agree on scope and ownership;
- every V0.1 assumption is either verified or explicitly marked unresolved;
- the current task fields and read path are documented from code, not memory;
- a technical design for V0.1 can be produced without inventing repository or platform facts;
- no implementation code is required to complete this milestone.

### Intentionally Manual

Everything remains manual because this is a documentation and inspection milestone.

---

## Next: V0.1 — Guided Task-Aware Review and Markdown Packet

V0.1 should be delivered in three small increments. They may share one release label, but each increment should remain testable and useful.

### V0.1A — Read-Only Task Snapshot

#### Value

Alix can retrieve and inspect real open tasks in review-friendly views without copying the task list manually.

#### Scope

- read incomplete tasks from the canonical Cloudflare-backed task system;
- retain stable source references and original wording;
- classify only from fields or rules that are explicitly supported;
- produce counts and groups for overdue, due this week, undated, domain, project, waiting-on, and carry-forward where data exists;
- display missing metadata separately from explicit null values;
- create a raw task appendix.

#### Dependencies

- verified read interface;
- verified field definitions;
- authentication and authorization design;
- agreed date-range and timezone handling.

#### Acceptance Criteria

- the output reflects actual open tasks from the canonical source;
- no task is written back, duplicated as canonical data, or silently omitted because optional metadata is absent;
- original wording is preserved;
- each grouping can be traced to source data or a labeled generated rule;
- missing fields are visible;
- task retrieval failure produces a clear, recoverable error rather than a misleading empty packet.

#### Intentionally Manual

- calendar context;
- project-state interpretation not represented in task data;
- health, learning, home, family, dogs, and restoration context;
- all prioritization and scheduling decisions.

### V0.1B — Resumable Guided Review Collector

#### Value

Alix can complete the review in manageable sections without remembering the structure or losing progress.

#### Scope

- create, resume, and explicitly restart a review session;
- establish the upcoming week and date range;
- collect only missing context through a consistent, skippable workflow;
- accept pasted, uploaded, or manually entered summaries;
- preserve raw manual input;
- support progressive disclosure and domain skip logic;
- collect role status and one or two outcomes only for active roles;
- collect candidate decisions such as schedule, delegate, break down, pause, drop, or discuss;
- save the last completed step and review status.

#### Dependencies

- a chosen review-session persistence mechanism;
- a stable task snapshot or task references for the session;
- documented privacy and retention expectations for manual input.

#### Acceptance Criteria

- an interrupted review can resume at the correct point;
- completed answers are not requested again unless the user chooses to revise them;
- every question can be skipped, marked unknown, or deferred where appropriate;
- the workflow does not require every domain or role to be active;
- source facts and manual answers remain distinguishable;
- restarting a session cannot alter canonical tasks.

#### Intentionally Manual

- judging the final priority order;
- constructing a detailed weekly schedule;
- entering summaries from unintegrated systems;
- approving any interpretation that would materially change planning.

### V0.1C — Sunday Planning Packet Generator

**Status: Complete as of July 26, 2026.** See `CURRENT_STATE.md` for deployed behavior and remaining field validation.

#### Value

Alix receives a complete, trustworthy Markdown packet that can be pasted into ChatGPT for collaborative planning.

#### Scope

- combine the task snapshot and guided-review answers;
- generate the documented packet sections in a stable order;
- label provenance and uncertainty;
- include missing-information notices;
- include raw task and raw manual-input references where useful;
- support regeneration after edits without losing source material;
- export or copy valid Markdown.

#### Dependencies

- V0.1A task snapshot;
- V0.1B session state;
- agreed packet schema and provenance labels.

#### Acceptance Criteria

- the packet contains the correct upcoming date range;
- system facts, manual input, generated flags, uncertain interpretations, and missing data are visibly distinct;
- the packet includes all required sections or clearly marks them not provided/not applicable;
- the packet makes no external changes;
- the packet is usable in a fresh ChatGPT conversation without re-explaining the Sunday Review vision;
- the packet can be regenerated deterministically from the same saved session, apart from explicitly variable timestamps or formatting.

#### Intentionally Manual

- ChatGPT collaboration;
- final prioritization;
- final schedule;
- task and calendar updates.

---

## Next: V0.2 — Better Review Continuity and Carry-Forward Decisions

### Goal

Reduce repeated questioning and make unfinished work more deliberate.

### Scope

- compare the current task snapshot with prior review packets or sessions;
- identify repeated carry-forward when source history supports it;
- remember prior weekly decisions and reasons;
- ask whether a stale item should be scheduled, delegated, broken down, paused, dropped, or discussed;
- support recurring-question customization and optional defaults;
- show what changed since the prior review;
- allow prior assumptions to be corrected or retired.

### Dependencies

- retained review-session history;
- stable task identifiers;
- privacy and retention policy;
- sufficient task history or review snapshots.

### Acceptance Criteria

- repeated items are identified from evidence, not guessed;
- prior decisions are shown with their source week;
- the user can override or delete outdated assumptions;
- the workflow asks fewer repeated questions without hiding important changes;
- carry-forward analysis never changes task data automatically.

### Intentionally Manual

- final decision for every stale item;
- task edits and calendar scheduling;
- interpretation of ambiguous historical reasons.

---

## Next: V0.3 — Project and Role Awareness

### Goal

Move from a task-only review toward a visible project portfolio and realistic role activation.

### Scope

- read project associations where available;
- represent project state: active, waiting, paused, maintenance-only, inactive, or backlog;
- collect current state, next action, blocker, blocker owner, and desired weekly outcome;
- surface projects with no next action or no recent review;
- allow one or two outcomes for active roles;
- capture minimum acceptable progress and protected time needs;
- separate visibility from weekly activation.

### Dependencies

- project identifiers or a safe mapping layer;
- decisions about whether project state belongs in shared External Brain data or Sunday Review session data;
- V0.2 continuity for stale-project detection.

### Acceptance Criteria

- every surfaced project has a deliberate weekly status or is marked unresolved;
- no project is activated solely because it exists;
- active roles are limited to realistic outcomes;
- project and role summaries preserve uncertainty and source provenance;
- the packet can clearly distinguish project status from task status.

### Intentionally Manual

- project activation decisions;
- project roadmap edits;
- creation of missing project records in shared infrastructure.

---

## Later: V0.4 — Read-Only Calendar Integration

### Goal

Remove manual reconstruction of fixed commitments while keeping scheduling decisions collaborative.

### Scope

- read Google Calendar events for the review period;
- identify fixed commitments and apparent unavailable time;
- capture travel and preparation buffers when represented or manually added;
- detect obvious overlaps or constraint-heavy days;
- allow the user to mark events as movable, fixed, incomplete, or irrelevant to capacity;
- include calendar facts in the packet.

### Dependencies

- approved Calendar access;
- timezone rules;
- calendar selection rules;
- event privacy and retention policy;
- a definition of fixed versus movable that does not rely on unsafe guessing.

### Acceptance Criteria

- calendar events are read without modification;
- events are traceable to the source calendar;
- conflicts and unavailable periods are generated flags, not facts about intent;
- all suggested buffers or capacity interpretations are labeled;
- no event is created, changed, or deleted.

### Intentionally Manual

- confirming which events affect capacity;
- adding missing travel/preparation context;
- choosing time blocks;
- all calendar writes.

---

## Later: V0.5 — Health, Capacity, and Learning Inputs

### Goal

Improve realism by reducing manual summaries for selected health and learning signals.

### Scope

This version may advance source by source rather than waiting for a complete health or learning platform.

Potential health sources:

- Samsung Health or Health Connect;
- workout history;
- steps and general activity;
- sleep;
- heart rate, stress, or recovery signals;
- nutrition, protein, hydration, weight, and body composition where appropriate and available.

Potential learning sources:

- Spanish tools and manually maintained progress;
- books and courses;
- chapters, quizzes, tests, and assignments;
- software-project learning;
- business and technical topics encountered during work;
- newsletter or reading insights.

### Dependencies

- source access and export/API feasibility;
- privacy and data-minimization decisions;
- unit and timezone normalization;
- explicit interpretation boundaries for health data;
- source-specific reliability evaluation.

### Acceptance Criteria

- each integrated metric includes source and time range;
- absence of data is not interpreted as failure;
- health summaries avoid diagnosis and false precision;
- manual correction remains possible;
- the review can still run if one integration is unavailable;
- learning commitments remain realistic and are not generated merely because data exists.

### Intentionally Manual

- subjective energy, pain, illness, mood, and recovery context;
- interpretation of health data that requires personal judgment;
- deciding which learning areas are active;
- setting minimum commitments.

---

## Later: V0.6 — AI-Assisted Planning Conversation

### Goal

Use the assembled context to recommend tradeoffs and a draft plan while preserving explainability and approval.

### Scope

- conduct a guided planning conversation using the packet and saved context;
- ask dynamic clarifying questions only when needed;
- recommend priority tiers;
- suggest defer, delegate, pause, drop, or break-down decisions;
- suggest realistic active-role outcomes and health minimums;
- protect high-brainpower work;
- place low-brainpower work in appropriate windows;
- generate a draft weekly schedule around fixed commitments;
- show the basis and uncertainty for recommendations.

### Dependencies

- trustworthy packet generation;
- a provider-flexible model boundary;
- evaluation cases based on real prior weeks;
- explicit handling of sensitive health and personal data;
- rules for what context is sent to any external model provider.

### Acceptance Criteria

- recommendations can be traced to packet facts and user-stated preferences;
- the system never presents a draft as an approved plan;
- the user can revise assumptions before accepting recommendations;
- overload and capacity mismatches are surfaced before scheduling;
- the workflow remains usable without the selected model provider.

### Intentionally Manual

- final tradeoffs;
- final schedule approval;
- all writes to external systems.

---

## Later: V0.7 — Fitness Planning

### Goal

Turn health, recovery, calendar, and fitness-goal context into an approved weekly workout plan.

### Scope

- track fitness goals and progressions;
- represent current workout patterns and constraints;
- draft a weekly workout plan around calendar and recovery;
- support skill progressions such as handstands;
- define fallback and minimum workouts;
- explain why a workout was suggested;
- prepare approved workout records for a future health-system write path.

### Dependencies

- reliable health and workout history;
- clear fitness-goal representation;
- safety boundaries and non-diagnostic language;
- approved destination for workout creation.

### Acceptance Criteria

- plans adapt to stated pain, illness, recovery, and time constraints;
- fallback options are included;
- no workout is written to an external system without approval;
- the system does not claim medical or coaching certainty it does not have.

### Intentionally Manual

- exercise execution and subjective recovery feedback;
- final plan approval;
- any clinician-required decisions.

---

## Later: V0.8 — Approved Actions

### Goal

Carry confirmed planning decisions back into connected systems with clear previews, approvals, and auditability.

### Candidate Actions

- create or update calendar blocks;
- update task priorities or due dates;
- record deliberate task deferral, pause, delegation, or drop decisions;
- create workouts;
- create reminders;
- send approved decisions to shared External Brain project or goal records.

### Dependencies

- mature read-only integrations;
- granular authentication and authorization;
- preview and approval user experience;
- idempotency and duplicate prevention;
- error handling and partial-failure recovery;
- audit log of proposed, approved, completed, and failed actions;
- rollback or correction paths where supported.

### Acceptance Criteria

- every action is previewed before approval;
- approval is specific to the action set and cannot be inferred from prior consent;
- the user sees exactly which system and records will change;
- duplicate actions are prevented;
- partial failures are clearly reported;
- performed actions are recorded with time, source decision, and result;
- no write path can bypass the approval boundary.

### Intentionally Manual

- deciding whether to approve;
- resolving ambiguous conflicts;
- correcting external-system limitations that cannot be reversed automatically.

---

## Later: V1.0 — Integrated Weekly Review

### Goal

Deliver a reliable end-to-end Sunday review that gathers context from selected systems, guides missing reflection, recommends a realistic plan, and performs only approved updates.

### Expected Capabilities

- reusable workflow independent of Telegram;
- task, project, calendar, health/capacity, learning, family, household, and restoration context;
- resumable sessions;
- prior-week comparison;
- active-role and project-state decisions;
- draft plan and schedule;
- approved task, calendar, reminder, workout, and External Brain updates;
- visible provenance, uncertainty, and audit history;
- graceful degradation when integrations are unavailable.

### Acceptance Criteria

- the review can be completed without manually reconstructing its structure;
- the system reduces repeated data entry across integrated sources;
- the final plan reflects fixed commitments and stated capacity;
- all external changes remain approved and auditable;
- Alix can correct remembered patterns and assumptions;
- the workflow can be invoked from more than one interface.

---

## Speculative: V1.x+ — Pattern Recognition and Adaptive Review

### Direction

- identify recurring reasons tasks fail;
- notice workload and capacity mismatches;
- compare schedule, sleep, health, and completion patterns;
- identify which weekly commitments are consistently realistic;
- tailor recurring review questions;
- surface neglected projects without activating them automatically;
- recommend process changes rather than merely moving tasks;
- remember previous decisions and their outcomes;
- detect when an old assumption no longer fits.

### Preconditions

- sufficient longitudinal data;
- explicit user value demonstrated by earlier versions;
- transparent explanations;
- controls to correct, delete, or ignore remembered patterns;
- privacy and retention policy appropriate to sensitive longitudinal data;
- evaluation against false or harmful pattern claims.

### Guardrails

- patterns are hypotheses, not facts;
- correlation is not causation;
- no hidden productivity score should control recommendations;
- a difficult week must not become a permanent identity;
- user corrections take precedence over learned assumptions.

---

## Cross-Cutting Workstreams

These workstreams evolve throughout the roadmap rather than belonging to one version.

### Reliability

- clear empty, partial, stale, and failed-data states;
- resumable sessions;
- deterministic packet regeneration where practical;
- idempotent future actions;
- graceful degradation.

### Privacy and Data Minimization

- collect only review-relevant data;
- document retention for raw manual input and health context;
- avoid unnecessary transmission to external providers;
- support deletion and correction of saved review context.

### Provenance and Explainability

- preserve source references;
- label facts, manual input, generated flags, uncertainty, and missing data;
- show the basis for future recommendations.

### Evaluation

- use real historical weeks as test cases where appropriate;
- test overloaded, low-energy, kid-heavy, travel, illness, and ordinary weeks;
- measure cognitive burden and usefulness, not only technical correctness;
- verify that the agent asks fewer unnecessary questions over time.

### Interface Independence

- keep the core workflow callable independently of Telegram;
- treat Telegram, dashboard, command line, or future parent brain as adapters;
- avoid storing essential workflow state only inside message history.
