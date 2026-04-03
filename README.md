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
- `/schools/[slug]/professors/[profSlug]` professor profile
- `/compare` comparison workspace
- `/methodology` scoring and coverage explanation

## Data-platform scaffolding

- [`db/schema.sql`](./db/schema.sql): normalized PostgreSQL schema
- [`etl/classly_etl`](./etl/classly_etl): adapter contract, normalization models, scoring, and matcher utilities
- [`etl/fixtures`](./etl/fixtures): sample institutional source payloads
- [`etl/tests`](./etl/tests): adapter and scoring verification

The app now reads `etl/output/published_catalog.json` when it exists and falls back to
the in-repo seeded catalog otherwise. That published snapshot is intended to hold:

- schools
- professor-course summaries
- department aggregates
- grade distribution series
- optional section meetings

## Live data commands

The first live path is now implemented for:

- U.S. College Scorecard school directory import
- UT Austin official grade dashboard CSV export
- Texas A&M official registrar grade-distribution PDFs
- RMP GraphQL sync scaffolding with raw snapshot + normalized output

Set `COLLEGE_SCORECARD_API_KEY` in `.env` before using the school importer.
The app automatically reads `etl/output/college_scorecard_schools.json` for
nationwide school search and fallback school pages when that file exists.
Set `RMP_GRAPHQL_ENDPOINT` before using the RMP sync script.

```bash
python -m etl.scripts.import_school_directory --output etl/output/college_scorecard_schools.json
python -m etl.scripts.fetch_native_grade_data --school ut-austin --output etl/output/ut_austin_sections.json
python -m etl.scripts.fetch_native_grade_data --school texas-am --year 2025 --term C --college EN --output etl/output/tamu_engineering_fall_2025.json
python -m etl.scripts.sync_rmp --school-slug texas-am --school-legacy-id 19
```
