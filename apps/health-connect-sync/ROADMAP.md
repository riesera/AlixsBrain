# Health Connect Sync Roadmap

This is a shared External Brain integration. It supplies trustworthy health context to Sunday Review, but Sunday Review does not own the health database or Android client.

## Completed — Local reader proof of concept

- Read selected Health Connect metrics without writing to Health Connect.
- Verify real source coverage on the target phone.
- Distinguish missing data from zero.
- Label consumed food energy separately from total energy burned.
- Translate Health Connect exercise codes into friendly names.

## Completed — Manual 30-day daily sync

- Store one canonical summary per device, local date, and timezone in D1.
- Authenticate the phone with a separate revocable device token.
- Preserve nullable measurements, sparse micronutrients, source coverage, and friendly exercise summaries.
- Make retries idempotent so corrected days replace rather than duplicate data.
- Manually backfill the 30 days currently available to the app.

## Completed — Weekly read and validation

- Add a read-only Worker API that derives a requested local week from canonical daily summaries.
- Return totals, averages, ranges, logged-day coverage, exercise summaries, and missing-data notices.
- Explicitly distinguish food consumed, energy burned, and incomplete energy-balance evidence.
- Add a small authenticated dashboard view for validating the derived week before it is used automatically.

## Completed — Sunday Review health context

- Prefill the Health and Capacity review step from the weekly health API.
- Preserve retrieval time, covered dates, source coverage, and missing-data notices.
- Keep subjective energy, stress, pain, illness, recovery, and realistic capacity as manual questions.
- Expose the saved, verified context to the future Markdown packet generator without diagnostic claims.

The Sunday Review Markdown packet generator now consumes the frozen health context with evidence dates, retrieval time, coverage, warnings, and non-diagnostic labels.

## Next — Historical export importer and compaction

- Select a Health Connect export through Android's system file picker.
- Inspect and version the actual export format before importing it.
- Import the entire available historical archive, subject to format validation and the retention rules below.
- Stream the archive locally instead of uploading or fully unpacking the raw archive.
- Normalize records, deduplicate overlap with recent API data, and checkpoint resumable progress.
- Inspect the export and available sources for a trustworthy structured stress signal; ingest it with explicit units and provenance when available, but do not derive or invent stress from unrelated measurements.
- Retain useful detail for 90 days, daily summaries for about two years, weekly summaries for about five years, and monthly summaries indefinitely.
- Upload compacted batches with counts and checksums; report success only after server verification.
- Never infer zero from missing data or invent historical nutrition/hydration targets.

The historical importer and compaction verifier are one milestone: a multi-year archive will not be uploaded before the retention rules can be enforced safely. Only verified, compacted summaries enter the External Brain and Sunday Review context; the raw archive remains a local import source rather than packet or model context. If no reliable structured stress field is available, subjective stress remains a manual Sunday Review answer.

Complete this milestone before beginning Sunday Review V0.3 Project and Role Awareness.

## Later — Incremental operation

- Sync new and corrected days without requiring a full manual backfill.
- Use supported Android background access when available, with an explicit foreground fallback when it is not.
- Track last successful sync, retry safely, and expose revocation/re-pairing controls.
- Add deterministic weekly/monthly compaction jobs and verification before deleting replaceable detail.

## Later — Targets and presentation

- Store only current food and hydration targets.
- Add useful trend views and charts in the main AlixsBrain dashboard.
- Improve the companion-app interface only where it helps permissions, imports, sync status, or recovery.

## Explicitly deferred

- Medical records and diagnostic interpretation.
- Exercise routes or GPS data.
- Historical target versions or retrospective target-attainment claims.
- Indefinite retention of individual food descriptions or high-volume raw events.
- Treating the Android proof-of-concept screen as the long-term health interface.
