# Health Connect Sync — Current State

**Last updated:** July 26, 2026  
**Stage:** Manual production sync with verified weekly consumption  
**Android package:** `com.alixsbrain.healthsync`

## Deployed and Working

- The Android companion reads Health Connect without writing to it.
- Requested data includes steps, sleep, exercise, nutrition and sparse micronutrients, hydration, weight, resting heart rate, and total calories burned.
- Food energy is labeled as consumed/logged; total calories burned includes basal and active energy.
- Exercise numeric types are converted to friendly names.
- Missing Health Connect values remain missing rather than becoming zero.
- A separate revocable bearer token authenticates the phone; dashboard and Telegram credentials are not embedded in the app.
- Manual 30-day sync writes one idempotent D1 summary per device, local date, and timezone.
- The authenticated Health dashboard and `GET /api/health/weekly` derive seven-day totals, averages, ranges, logging coverage, exercises, sources, daily validation rows, and warnings.
- Sunday Review snapshots the seven days immediately preceding its upcoming planning week and shows that evidence in Step 8 while keeping subjective capacity questions manual.
- The deterministic Markdown Sunday Planning Packet includes that frozen evidence range, retrieval time, coverage, warnings, and manual subjective context.

## Verified Production Data

The first successful phone backfill stored 30 dates from June 27 through July 26, 2026:

- steps: 30 days;
- sleep: 30 days;
- calories burned: 30 days;
- exercise: 22 days;
- weight: 17 days;
- food and nutrients: 6 days;
- water: 0 days;
- resting heart rate: 0 days.

Zero coverage means connected Health Connect sources returned no record; it does not mean a measured value of zero. July 26 may be a partial day because it was synchronized before the day ended.

## Canonical Storage and APIs

- D1 table: `health_daily_summary`
- Phone ingestion: `PUT /api/health/daily`, authenticated only by `HEALTH_SYNC_TOKEN`
- Weekly read: `GET /api/health/weekly?week_start=YYYY-MM-DD&timezone=IANA_ZONE`, authenticated by dashboard Basic auth
- Review snapshot: `sunday_review_health_snapshot`, owned by Sunday Review as retrieved workflow context
- Review refresh: `PUT /api/reviews/:session_id/health-context`, authenticated by dashboard Basic auth

Daily uploads replace the same device/date/timezone row. Weekly reads do not mutate canonical health data. Review snapshots preserve retrieval time and do not contain device IDs or ingestion credentials.

## Important Limitations

- The current phone reports historical-read permission unavailable, so direct Health Connect reads are limited to the default accessible history, currently 30 days before initial permission grant.
- Synchronization is manual; there is no scheduled background sync yet.
- The app stores daily summaries, not the complete 90-day event-detail tier envisioned by the retention decision.
- Historical export import and deterministic daily/weekly/monthly compaction are not implemented.
- Current nutrition and hydration targets are not implemented.
- No medical records, diagnoses, exercise routes, or GPS data are collected.
- A locally built APK contains the current revocable device token. Rotating/removing the Worker secret revokes that build.

## Next Milestone

Build the historical Health Connect export importer together with its compaction verifier:

1. inspect and version the actual downloaded export format;
2. select it through Android's system file picker;
3. process the entire available historical archive locally without uploading the raw archive;
4. inspect the export and available sources for a trustworthy structured stress signal, preserving provenance and leaving subjective stress manual when none exists;
5. stream and normalize records without loading the full archive into memory or model context;
6. deduplicate overlap with recent API-derived days;
7. compact by retention tier before upload;
8. upload resumable batches with counts and checksums;
9. report success only after D1 verification.

Only verified, compacted historical summaries should enter the External Brain and future Sunday Review context. This milestone is the selected next implementation focus after the current Sunday Review field validation and must be completed before Sunday Review V0.3 Project and Role Awareness begins.

See `ROADMAP.md` and the External Brain/Sunday Review decision logs for the governing retention and missing-data rules.
