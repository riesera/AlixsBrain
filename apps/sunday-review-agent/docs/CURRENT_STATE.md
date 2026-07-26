# Current State

**Last updated:** July 26, 2026  
**Project stage:** Documentation and planning  
**Implementation status:** Not started

## Current Active Milestone

The active milestone is **V0.0: documentation foundation and inspection of the existing task system**.

The immediate objective is to turn the product vision into a verified implementation plan without assuming facts about the current repository, Cloudflare architecture, task schema, APIs, authentication, or deployment.

## What Is Known

### Product Purpose

The Sunday Review Agent is a specialized project within Alix's External Brain. It owns the weekly review workflow and exists to reduce the memory, gathering, and blank-page burden of Sunday planning.

### V0.1 Product Scope

The first usable version is a guided, non-autonomous collector and Markdown packet generator.

It must:

- read real open tasks from the existing Cloudflare-backed task system;
- organize available task data without inventing missing metadata;
- guide Alix through the parts of the review that cannot yet be populated automatically;
- accept pasted, uploaded, or manually entered summaries;
- save progress and resume an interrupted review;
- generate a Sunday Planning Packet for collaborative planning in ChatGPT;
- keep source facts, manual input, generated flags, uncertainty, and missing data distinguishable.

It must not independently plan the week or change external systems.

### Shared-Infrastructure Boundary

- Alix's External Brain owns shared data and shared infrastructure.
- The existing task system owns canonical to-do data.
- Canonical task data currently lives in Cloudflare-backed infrastructure.
- The Sunday Review Agent reads that data.
- The Sunday Review Agent may own review-session state and generated packets.
- Review-session state is not a second canonical task store.
- Telegram may trigger or display the workflow, but reusable Sunday Review logic must not be owned by Telegram.
- A future dashboard or parent External Brain must be able to invoke the same workflow.

### V0.1 Inputs

The task system is the only required automatic source.

Other context may initially be entered manually, including:

- calendar and fixed commitments;
- health, capacity, workouts, food, and hydration;
- learning progress;
- CLM operations and business context;
- projects and decisions waiting on others;
- home, family, dogs, and restoration.

### V0.1 Output

A structured Markdown Sunday Planning Packet that can be pasted into ChatGPT.

## What Is Assumed but Not Yet Verified

The following statements are product assumptions, not confirmed implementation facts:

1. The existing task system exposes a safe read path that Sunday Review can reuse.
2. Tasks have stable identifiers or another reliable source reference.
3. Incomplete status can be queried without scraping Telegram messages.
4. Due dates distinguish an explicitly undated task from a missing or unreadable field.
5. Domain and project information exist in a structured form.
6. Owner, priority, status, waiting-on, source, and creation metadata may exist.
7. Enough history exists to identify repeated carry-forward behavior.
8. The task system can be read without coupling the workflow to Telegram.
9. Current authentication can be extended or reused safely.
10. A small amount of Sunday Review-owned state can be persisted for resumability.
11. Markdown export can be produced in a way usable from the chosen interface.
12. Uploaded summaries can be accepted in V0.1 without requiring a broad document-ingestion subsystem.

Each assumption must be confirmed, revised, or rejected after codebase inspection.

## Unresolved Product Decisions

These questions do not block documentation but must be resolved during implementation planning:

- What is the exact definition of the upcoming week: Monday through Sunday, Sunday through Saturday, or configurable?
- What constitutes an overdue task when due-time or timezone information is incomplete?
- How should kid-week status be represented and sourced in V0.1?
- Which standing roles should appear by default, and how can Alix customize them?
- Which review sections are required, optional, or hidden when not relevant?
- Should raw manual input be retained indefinitely, retained for a limited period, or removable after packet generation?
- Should generated packets be immutable historical snapshots, regenerable views, or both?
- How should a user explicitly restart, abandon, archive, or duplicate a review session?
- What minimum task metadata is required to proceed if the source schema is sparse?
- Should project-state input remain review-local at first or be written to a future shared project system only after approval?

## Unresolved Technical Decisions

The following choices are intentionally open:

- repository placement;
- module and service boundaries;
- runtime and programming language;
- deployment platform;
- review-session persistence mechanism;
- task read interface;
- authentication and authorization approach;
- Telegram adapter design;
- future dashboard interface;
- file-upload handling;
- Markdown export and storage path;
- observability and logging design;
- testing strategy;
- model usage, provider, and framework;
- whether V0.1 needs any model at all.

No documentation should imply these choices have been made.

## Immediate Next Step

Conduct an implementation-planning inspection of the existing task system.

The inspection should produce a short technical findings document containing:

1. repository structure and relevant modules;
2. Cloudflare products and bindings in use;
3. canonical task schema with examples;
4. field nullability and missing-value behavior;
5. stable identifiers;
6. query/read paths;
7. authentication and authorization;
8. task-history availability;
9. Telegram-specific versus reusable logic;
10. deployment and local-development process;
11. likely location for Sunday Review workflow state;
12. risks, constraints, and recommended V0.1 packaging.

After that inspection, the next planning session should convert `REVIEW_FLOW.md` into an implementation design and milestone checklist.

## Explicitly Not Built

As of this document date, none of the following exists for the Sunday Review Agent:

- repository or project directory;
- application code;
- task-system connector;
- task snapshot generator;
- guided review interface;
- review-session storage;
- resume behavior;
- upload or paste ingestion;
- role activation logic;
- carry-forward analysis;
- project-state model;
- provenance labeling implementation;
- packet generator;
- ChatGPT integration;
- Google Calendar integration;
- health or fitness integration;
- learning integration;
- journal integration;
- planning model or recommendation engine;
- calendar, task, workout, reminder, or External Brain write actions;
- tests, deployment, monitoring, or operational runbooks.

The project should continue to be described as planned, not implemented.

## Documentation Completed in This Foundation

- `README.md`
- `SOUL.md`
- `ROADMAP.md`
- `CURRENT_STATE.md`
- `DECISIONS.md`
- `REVIEW_FLOW.md`

These documents define the product foundation. They do not replace inspection of the existing codebase.
