# Sunday Review Agent — Current State

**Last updated:** July 26, 2026  
**Project stage:** V0.1 implementation  
**Active milestone:** First complete real-review field validation

## Executive Summary

The original documentation/inspection phase is complete. The active Cloudflare Worker now contains the first two V0.1 increments and a production dashboard interface:

- V0.1A canonical read-only task snapshot: complete;
- V0.1B resumable guided review collector: complete for typed and pasted input;
- shared Health Connect weekly context in Step 8: complete;
- V0.1C deterministic Markdown planning packet: complete.

The dashboard is deployed at `https://alixsbrain-capture.alix-98e.workers.dev` behind the existing HTTP Basic authentication. It has Tasks, Sunday Review, and Health tabs.

## Implemented Architecture

The feature lives in the existing `worker/` Cloudflare Worker and D1 database rather than a separate service.

Reusable domain modules:

- `worker/src/task-reader.ts` — verified canonical task reads independent of Telegram and dashboard rendering;
- `worker/src/review-sessions.ts` — review guide, session persistence, answers, progress, lifecycle, task references, and health snapshots;
- `worker/src/health-reader.ts` — shared deterministic weekly health aggregation;
- `worker/src/review-packet.ts` — frozen task snapshots, deterministic 23-section Markdown, provenance, raw appendices, and immutable packet versions;
- `worker/src/review-api.ts` — thin authenticated review HTTP adapter;
- `worker/src/health-api.ts` — thin authenticated weekly health read adapter;
- `worker/public/` — temporary responsive AlixsBrain dashboard interface.

Telegram remains an ingestion adapter. Sunday Review logic does not depend on Telegram messages or identity fields.

## V0.1A — Canonical Task Reader

Implemented behavior:

- reads only `item`, `item_flag`, and preserved `raw_capture.raw_text` needed for canonical task output;
- preserves raw capture wording exactly;
- returns only verified fields and retains missing optional values as null;
- supports Inbox, Open, Waiting, Done, and Archived explicitly;
- excludes `metadata_json`, Telegram identity fields, credentials, and tokens;
- preserves existing dashboard API compatibility;
- uses stable item IDs as review task references.

Known limitation: reliable carry-forward history does not yet exist. Step 7 therefore remains manual and must not infer repeated carry-forward from task age alone.

## V0.1B — Resumable Guided Review

Implemented behavior:

- starts or resumes an explicit week and IANA timezone;
- persists one active review per week/date range/timezone;
- saves raw typed or pasted answers exactly;
- supports answered, none, not applicable, unknown, skipped, and deferred responses;
- tracks completed/skipped steps and resumes at the first incomplete step;
- references the canonical task IDs captured when the review begins;
- supports explicit restart, abandon, complete, and archive transitions;
- prevents terminal sessions from being edited;
- marks the collector `ready_for_packet` only after all collection steps are completed or skipped;
- does not write to canonical tasks or external systems.

The dashboard implements all 13 collection sections defined by `REVIEW_FLOW.md`. Step 2 displays canonical task context automatically. Other steps remain manual except for the read-only health evidence described below.

Not yet implemented in the collector:

- actual file upload handling despite the schema reserving `uploaded_summary` as an input kind;
- customizable role vocabularies or recurring prompts;
- automatic calendar, learning, project, journal, or business integrations;
- reliable carry-forward comparison across prior reviews.

## Health and Capacity Integration

For a review covering an upcoming planning week, Step 8 snapshots the seven calendar days immediately preceding `week_start` from canonical shared health summaries.

The snapshot preserves:

- evidence start/end dates and timezone;
- retrieval timestamp;
- stored-day and metric coverage;
- totals, averages, ranges, and daily validation rows;
- friendly exercise summaries;
- sparse nutrient/source coverage;
- missing-data and incomplete-range warnings.

The snapshot excludes phone credentials and device IDs. It is frozen for resumability, with an explicit refresh available while the review remains editable. Health Connect does not answer the manual question: subjective energy, stress, pain, illness, recovery, capacity, and realistic minimums still require Alix's input.

Energy balance is omitted unless both food and total-burned-energy coverage are complete for all seven days. Health output remains non-diagnostic.

## V0.1C — Sunday Planning Packet

Implemented behavior:

- generates all 23 top-level sections in the stable `REVIEW_FLOW.md` order;
- includes a self-contained planning request usable in a fresh ChatGPT conversation;
- visibly labels system facts, manual input, generated flags, missing data, and unsupported analysis;
- computes only documented task groupings such as overdue, due-this-week, undated, waiting, project, and domain;
- refuses to infer reliable carry-forward or parse free text into high/low-brainpower, defer, pause, or drop classifications;
- includes the frozen health evidence and manual subjective capacity response;
- includes exact raw task wording and raw manual-input appendices;
- stores immutable incrementing packet versions in D1;
- warns when an older packet predates later review edits;
- supports copy-to-clipboard and Markdown download from the dashboard;
- permits regeneration without overwriting earlier packet versions;
- makes no external changes and invokes no model.

New sessions freeze verified task fields at review creation. The one legacy production session predates that table; its first packet generation may backfill still-readable referenced task fields and will visibly report the later snapshot timestamp.

## D1 State Owned by Sunday Review

Migrations:

- `0003_sunday_review_sessions.sql`
  - `sunday_review_session`
  - `sunday_review_task_reference`
  - `sunday_review_answer`
  - `sunday_review_step_state`
- `0005_sunday_review_health_snapshot.sql`
  - `sunday_review_health_snapshot`
- `0006_sunday_review_packets.sql`
  - `sunday_review_task_snapshot`
  - `sunday_review_packet`

Review state is workflow state, not a second canonical task or health store.

## APIs

All review reads/writes use existing dashboard Basic authentication:

- `GET /api/reviews/guide`
- `POST /api/reviews`
- `GET /api/reviews/active`
- `GET /api/reviews/:id`
- `PUT /api/reviews/:id/answers/:step/:field_key`
- `PUT /api/reviews/:id/steps/:step`
- `PUT /api/reviews/:id/health-context`
- `GET /api/reviews/:id/packet`
- `POST /api/reviews/:id/packet`
- `POST /api/reviews/:id/actions`

Canonical weekly health validation is available separately at `GET /api/health/weekly`.

## Explicitly Not Built

- ChatGPT/API model integration;
- automatic prioritization or scheduling;
- task/calendar/workout/reminder write actions;
- automatic external-system changes;
- file upload storage or parsing;
- historical Health Connect export import and retention compaction;
- background Health Connect synchronization;
- multi-user identity or authorization.

## Next Milestone — Complete Real-Review Field Validation

Run one end-to-end Sunday Review using real task and health data.

Field-validation checklist:

1. finish or deliberately skip all 13 collection steps;
2. generate packet version 1;
3. inspect provenance, missing-data notices, task groupings, health coverage, and raw appendices;
4. copy the Markdown into a fresh ChatGPT conversation and confirm it is self-contained;
5. correct at least one saved answer, regenerate version 2, and verify version 1 remains unchanged;
6. record confusing prompts, excessive packet detail, missing context, and any unsupported grouping that is actually needed.

After field validation, choose between V0.2 review continuity/carry-forward work and the separate Health Connect historical-import/compaction milestone based on observed value.

## Verification and Operations

Worker verification commands:

```powershell
cd worker
npm.cmd test
npm.cmd run check
node --check public\assets\app.js
```

Deployment:

```powershell
cd worker
npx.cmd wrangler d1 migrations apply DB --remote
npx.cmd wrangler deploy
```

Secrets must remain in Cloudflare Worker secrets or local ignored configuration. Never commit dashboard, Telegram, or Health Sync credentials.
