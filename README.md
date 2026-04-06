# Classify

Classify is a Next.js prototype for professor and course intelligence. It combines a
distinct 3D marketing homepage with an app shell for search, school hubs, department
rankings, course leaderboards, professor profiles, comparison mode, and methodology.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4
- Framer Motion + React Three Fiber
- Published-catalog loader with seeded fallback data for schools, course outcomes, and RMP fallback
- Python ETL skeleton with adapter fixtures and parser tests

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test

```bash
npm run lint
npm run test
python -m unittest discover etl/tests -v
```

Install the ETL dependencies separately when you want the live adapters:

```bash
python -m pip install -r etl/requirements.txt
```

## Key routes

- `/` immersive Classify homepage
- `/search` universal search with autosuggest
- `/schools/[slug]` school hub
- `/schools/[slug]/departments/[departmentSlug]` department rankings
- `/schools/[slug]/courses/[courseSlug]` course leaderboard
- `/schools/[slug]/instructors` full instructor directory (sort, filter, pagination)
- `/schools/[slug]/my-courses` planner: multi-course list with shared sort and shareable `?courses=` links
- `/schools/[slug]/professors/[profSlug]` professor profile
- `/compare` comparison workspace
- `/methodology` scoring and coverage explanation

## Data-platform scaffolding

- [`db/schema.sql`](./db/schema.sql): normalized PostgreSQL schema
- [`etl/classly_etl`](./etl/classly_etl): adapter contract, normalization models, scoring, and matcher utilities
- [`etl/fixtures`](./etl/fixtures): sample institutional source payloads
- [`etl/tests`](./etl/tests): adapter and scoring verification

The app now prefers a DB-backed published layer when Supabase is configured. During
local development, it can still read `etl/output/published_catalog.json`; otherwise it
falls back to the in-repo seeded catalog. In production, the intended path is DB first,
with directory-only emergency fallback rather than silent seed-data usage. That published
layer is intended to hold:

- schools
- professor-course summaries
- department aggregates
- grade distribution series
- optional section meetings

Set `SUPABASE_SERVICE_ROLE_KEY` alongside `NEXT_PUBLIC_SUPABASE_URL` when you want the
app to read the published layer directly from Supabase/Postgres instead of the local
snapshot file.

To publish the current `etl/output/published_catalog.json` snapshot into Supabase:

```bash
npm run catalog:doctor:supabase
npm run catalog:validate:supabase
npm run catalog:publish:supabase -- --dry-run
npm run catalog:publish:supabase
npm run catalog:rollback:supabase -- --run-id <raw_source_snapshot_id>
```

Use `npm run catalog:doctor:supabase` first whenever the app still falls back to seed data.
It verifies the configured Supabase project, shows whether a service-role key is present, and
checks the published catalog tables one by one so you can see exactly which table is missing
from the API/schema cache.

Use `npm run catalog:validate:supabase` before promotion in CI or deployment hooks. It checks
that required tables are visible and that published row counts do not regress unexpectedly.

The runtime health endpoint and admin dashboard are:

- `/api/health/catalog`
- `/admin/readiness`

## Live data commands

The first live path is now implemented for:

- U.S. College Scorecard school directory import
- UT Austin official grade dashboard CSV export
- Texas A&M official registrar grade-distribution PDFs
- RMP GraphQL sync scaffolding with raw snapshot + normalized output

Set `COLLEGE_SCORECARD_API_KEY` in `.env` before using the school importer.
The app automatically reads `etl/output/college_scorecard_schools.json` for
nationwide school search, dev catalog merge (with seed), and merge/publish of extra
directory-only school rows into the DB-backed `schools` table.
That path is gitignored until you generate it—use a live import or, for offline verification:

```bash
npm run catalog:directory:fixture
```

(`python -m etl.scripts.import_school_directory --fixture` — no API key.)

For the full nationwide import, run:

```bash
python -m etl.scripts.import_school_directory --output etl/output/college_scorecard_schools.json
npm run catalog:publish:supabase
```

By default, the importer targets undergraduate-serving public/private institutions
using College Scorecard ownership and predominant-award filters. Once the JSON is
present, the publish step folds those schools into the main `schools` table even if
they do not have local catalog, section, or evidence depth yet.

With the JSON present, `npm run catalog:merge` can emit `published_catalog.json` containing seed
plus directory-only schools even when no reconciled offerings exist; `/api/health/catalog` reports
searchable, catalog-ready, schedule-ready, and evidence-ready school counts separately.

Set `RMP_GRAPHQL_ENDPOINT` before using the RMP sync script.

To build a nationwide professor-source registry from the College Scorecard directory,
published catalog state, and any existing `rmp_*.json` snapshots:

```bash
npm run catalog:build-source-registry
```

This writes `etl/output/school_source_registry.json` and tracks, per school:

- directory coverage
- published catalog / section / official-grade depth
- current professor-coverage level
- RMP sync readiness and known school legacy IDs
- existing normalized RMP snapshots and match-audit counts

To bulk-sync school-scoped RMP data for registry rows that already have known RMP
school IDs:

```bash
npm run catalog:sync-rmp:bulk -- --only-missing --limit 50
```

That command updates the registry in place and writes:

- `etl/output/raw/rmp_<school>.json`
- `etl/output/rmp_<school>.json`

If you need to map additional RMP school IDs manually, create
`etl/output/school_source_registry_overrides.json` keyed by `school_slug`, for example:

```json
{
  "ut-austin": {
    "rmp_school_legacy_id": "19"
  }
}
```

The registry builder merges those overrides and marks schools without known RMP
IDs as `pending_school_id` instead of guessing.

### Texas A&M batch catalog (ingest → app snapshot)

Run in order. Raw artifacts are written under `etl/output/raw/tamu/`; combined records and
offerings use `etl/output/tamu_records.json` and `etl/output/tamu_offerings.json`. The app
reads `etl/output/published_catalog.json` when present (often gitignored in fresh clones).

1. **Batch fetch** (live HTTP). Use `--fixture` for offline tests against saved fixtures.

   ```bash
   python -m etl.scripts.fetch_tamu_batch
   ```

2. **Aggregate** professor–course rows into catalog-shaped offerings:

   ```bash
   npm run catalog:tamu:catalog
   python -m etl.scripts.aggregate_tamu_records
   ```

   `catalog:tamu:catalog` enriches TAMU rows with official course titles and
   descriptions from the public TAMU undergraduate catalog before the offerings
   snapshot is rebuilt.

3. **Merge** TAMU offerings into the published snapshot (replaces all `texas-am` seed offerings;
   exits successfully if `tamu_offerings.json` is missing):

   ```bash
   npm run catalog:merge
   ```

4. **Build** or **dev** so Next.js picks up `published_catalog.json`.

College codes for batch runs live in `etl/fixtures/tamu_college_codes.json`.

```bash
python -m etl.scripts.import_school_directory --output etl/output/college_scorecard_schools.json
python -m etl.scripts.fetch_native_grade_data --school ut-austin --output etl/output/ut_austin_sections.json
python -m etl.scripts.fetch_native_grade_data --school texas-am --year 2025 --term C --college EN --output etl/output/tamu_engineering_fall_2025.json
python -m etl.scripts.sync_rmp --school-slug texas-am --school-legacy-id 19
```
