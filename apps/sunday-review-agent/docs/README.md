# Sunday Review Agent

## Status

**Planning and documentation only. No implementation exists yet.**

The current active milestone is to define the smallest useful V0.1 and inspect the existing External Brain task system before choosing a repository layout, runtime, persistence mechanism, interface, model, provider, framework, or deployment approach.

## What This Project Is

The Sunday Review Agent is a specialized component of **Alix's External Brain**. Its purpose is to reduce the cognitive effort required to review the previous week and prepare a realistic plan for the next one.

It is not just a task-list viewer, a Telegram command, or a generic weekly checklist. It owns a reusable **weekly review and planning workflow** that can eventually combine task, project, calendar, health, learning, family, household, business, and reflection context.

The first version is intentionally smaller: it gathers and organizes context, guides Alix through the information that is still missing, saves review progress, and generates a Markdown planning packet for collaborative planning in ChatGPT.

## Why It Exists

Sunday planning stopped being sustainable because the review itself demanded too much memory and decision-making before planning could even begin. The recurring burden included:

- remembering every area of life that needed consideration;
- gathering tasks and commitments from different places;
- reconstructing the prior week;
- deciding what was urgent, important, blocked, stale, or optional;
- noticing tasks that were being carried forward without a deliberate decision;
- balancing business, health, learning, family, home, and restoration;
- translating all of that into a realistic week.

The Sunday Review Agent removes the blank-page burden. It should remember the structure of the review so Alix does not have to.

## Relationship to Alix's External Brain

The conceptual ownership boundary is:

- **The External Brain owns shared data and shared infrastructure.**
- **The existing Cloudflare-backed task system owns canonical to-do data.**
- **The Sunday Review Agent reads shared task data.**
- **The Sunday Review Agent owns the weekly review workflow, review-session state, and generated planning packet.**
- **The Sunday Review Agent does not create a second canonical task database.**
- **Telegram may trigger or display the workflow, but Telegram does not own the workflow logic.**
- **A future dashboard or parent External Brain should be able to invoke the same workflow.**

Technical packaging is intentionally undecided. The Sunday Review Agent may eventually live in the existing repository, a shared monorepo, or a separate repository. That decision must follow inspection of the current codebase.

## V0.1: First Usable Version

V0.1 is a **guided, resumable, non-autonomous review collector and packet generator**.

It will:

1. read actual incomplete tasks from the existing Cloudflare-backed task system;
2. preserve original task wording and available source metadata;
3. organize tasks into useful review views without inventing missing fields;
4. identify visible categories such as overdue, due this week, undated, waiting, and repeatedly carried forward when the source data supports them;
5. guide Alix through a consistent review of commitments, work, projects, health, learning, home, family, dogs, and restoration;
6. ask only for information that is unavailable or still ambiguous;
7. accept pasted, uploaded, or manually entered summaries for systems that are not integrated;
8. save progress so an unfinished review can be resumed;
9. generate a structured Markdown **Sunday Planning Packet**;
10. make facts, manual input, generated flags, uncertainty, and missing data visibly different.

## What V0.1 Will Not Do

V0.1 will not:

- independently prioritize or schedule the week;
- write changes back to the canonical task system;
- create, move, or delete calendar events;
- create workouts or health records;
- send reminders or messages;
- make external changes without approval;
- infer unavailable task metadata as fact;
- require every life role to be active every week;
- require a particular AI model, provider, agent framework, repository structure, database product, or deployment platform.

The output is context for collaborative planning, not an autonomous plan.

## Current Inputs

### Automatic in V0.1

The existing Cloudflare-backed task system is the only required automatic source for the first usable version. The agent should attempt to retrieve:

- incomplete tasks;
- overdue tasks;
- tasks due during the upcoming week;
- undated tasks;
- domain and project associations;
- waiting-on information;
- carry-forward history;
- priority, owner, status, due date, original wording, source, and creation metadata.

Some of these fields may not exist yet. Their absence must be reported, not guessed.

### Manual or Pasted in V0.1

Until integrations exist, Alix may provide summaries for:

- calendar commitments and unavailable time;
- health, sleep, nutrition, hydration, stress, energy, pain, or recovery;
- workouts and fitness goals;
- Spanish, books, courses, technical learning, and assignments;
- CLM operations, customers, sales, finance, procurement, logistics, and systems work;
- home, errands, kids, family, Dan coordination, Rez, Billie, reading, baking, rest, and enjoyable activities.

## V0.1 Output

The primary output is a Markdown **Sunday Planning Packet** containing:

- a planning request for ChatGPT;
- week-at-a-glance context;
- task-system summary;
- urgent and administrative work;
- active projects;
- tasks by domain;
- waiting-on items;
- carry-forward decisions;
- health and capacity;
- learning progress;
- home, family, dogs, and restoration;
- goals by active role;
- possible high- and low-brainpower work;
- decisions needed;
- candidate not-this-week, pause, and drop items;
- a raw task appendix.

The packet is designed to be pasted into ChatGPT so Alix and ChatGPT can collaboratively prioritize, make tradeoffs, establish realistic minimums, and create a schedule around fixed commitments.

## Planning Principles

The project follows these principles:

- Reduce cognitive load before maximizing productivity.
- Ask only for information the system cannot already know.
- Preserve original wording and raw input.
- Make missing data and uncertainty visible.
- Keep human judgment final.
- Require approval before external actions.
- Protect high-brainpower work from automatic end-of-day placement.
- Match low-brainpower work to lower-energy periods.
- Separate urgent work from important but nonurgent work.
- Force a deliberate decision on repeatedly carried-forward work.
- Treat delegation, decomposition, pausing, dropping, and deferral as valid outcomes.
- Include health, capacity, restoration, and enjoyment in realistic planning.
- Interpret “No project left behind” as visibility and deliberate status, not mandatory weekly activity.

## Standing Roles and Domains

The review may consider roles such as:

- CLM Chief of Staff / Operations;
- Business Builder;
- Customer and Sales Support;
- Procurement and Logistics;
- Finance and Administration;
- Software Developer;
- External Brain Builder;
- Learner;
- Spanish Student;
- Business and Technical Student;
- Health and Fitness;
- Partner;
- Parent / Family;
- Home and Organization;
- Dog Caregiver;
- Personal Restoration;
- Reader / Creative Interests.

A role may be **active**, **maintenance-only**, **waiting**, **paused**, **inactive**, or **backlog** for a particular week. Active roles should usually have only one or two realistic outcomes and may include a minimum acceptable level of progress.

## How to Read This Documentation

- [`SOUL.md`](SOUL.md) — the project's constitution, values, safety boundaries, and definition of success.
- [`ROADMAP.md`](ROADMAP.md) — phased delivery plan, dependencies, acceptance criteria, and intentionally manual boundaries.
- [`CURRENT_STATE.md`](CURRENT_STATE.md) — what is known now, what is unverified, what is unresolved, and what has not been built.
- [`DECISIONS.md`](DECISIONS.md) — product and architecture decision log.
- [`REVIEW_FLOW.md`](REVIEW_FLOW.md) — V0.1 review lifecycle, data expectations, provenance labels, resumable session behavior, and packet structure.

## Guidance for the First Implementation-Planning Session

Before choosing technologies or writing code, inspect the current task-system codebase and answer:

1. How are tasks stored in Cloudflare, and which Cloudflare products are involved?
2. What stable task identifier exists?
3. Which fields exist today, and how are null, missing, and unknown values represented?
4. How are domains, projects, owners, statuses, priorities, waiting-on states, and due dates represented?
5. Is task history retained well enough to identify carry-forward behavior?
6. What read interface already exists: internal function, HTTP endpoint, Worker binding, database query, or other mechanism?
7. What authentication and authorization boundaries protect the task data?
8. Where can resumable Sunday Review session state safely live without becoming a duplicate task store?
9. Which parts of the current Telegram interface can remain a thin adapter to reusable workflow logic?
10. What export path can reliably produce a Markdown packet?

The answers should drive the first technical design. They should not be assumed in advance.
