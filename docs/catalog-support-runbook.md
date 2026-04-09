# Catalog support runbook

How schools move from **directory-only** to **RMP-backed national depth** to **full institutional** coverage in this repo.

## Concepts

| Layer | What users get | Typical `plannerReadiness` |
| ----- | ---------------- | --------------------------- |
| **Directory** | School exists in search / scorecard-backed directory | `directory_ready` |
| **RMP national** | Professor directory + placeholder offerings from Rate My Professors | Often `catalog_ready` once merged (no real schedules) |
| **Institutional** | Real courses, sections/meetings where ingested, official or strong grade evidence | `catalog_ready` → `schedule_ready` → `evidence_ready` |

`data/expansion-priority.json` uses **`dataTier`**: `institutional` (seeded today for a fixed set in `lib/data.ts`) vs `rmp_national` (expand via RMP until registrar feeds land).

## 1. Directory baseline

- **Full nationwide directory (local ETL):** run the College Scorecard import so `etl/output/college_scorecard_schools.json` exists (API key as required by `etl/scripts/import_school_directory.py`).
- **Fixture / CI:** `npm run catalog:directory:fixture`
- **Production fallback:** committed `data/college_scorecard_schools.json` (see `SCORECARD_DIRECTORY_DATA_BUNDLE_PATH` in `lib/scorecard-directory.ts`); do not rely on `etl/output/` alone on Vercel.

## 2. RMP national depth (professors + honest placeholders)

Use this to “support” many schools with **school-scoped RMP** without inventing schedules.

1. **Verify** the Rate My Professors school page matches the institution, note the numeric id from `https://www.ratemyprofessors.com/school/{id}`.

2. **Map** Scorecard **directory slug** → RMP id in `data/rmp_school_legacy_ids.json` (slug must match rows in the directory JSON). If the app uses a short canonical slug, keep TS and Python in sync: `lib/scorecard-directory.ts` (`canonicalScorecardSchoolSlug` / `SCORECARD_SCHOOL_SLUG_CANONICAL`) and `etl/classly_etl/scorecard_canonical_slug.py`.

3. **Registry:** `npm run catalog:build-source-registry`  
   - Output: `etl/output/school_source_registry.json`  
   - Confirms RMP is `ready` / `synced` vs `pending_school_id`.

4. **Sync RMP:** set `RMP_GRAPHQL_ENDPOINT`, then  
   `npm run catalog:sync-rmp:bulk`  
   - Writes normalized snapshots under `etl/output/rmp_*.json` (and often `etl/output/raw/`).

5. **Materialize reconcile slices** from those snapshots:  
   `npm run catalog:materialize-rmp-slices`  
   - Writes `etl/output/reconcile/{canonical}_enriched.json` with synthetic `rmp_only`-style rows.  
   - **By default skips** seed schools curated in `lib/data.ts`; use `--include-seed-slugs` only if you intend RMP to replace that curated merge base for those slugs.

6. **Merge:** `npm run catalog:merge`  
   - Produces `etl/output/published_catalog.json` (and runs expansion reporting if configured).

7. **Remote DB (optional):** `npm run catalog:publish:supabase` then validate (`npm run catalog:validate:supabase`).

## 3. Full institutional depth

**There is no single command** that adds real registrar data for arbitrary schools.

- **Today’s seeded “full” cohort:** offerings and school metadata in `lib/data.ts` for the launch schools; merge layers directory + reconciled replacements on top of that seed when present.
- **New institutional schools:** implement **per-school (or per-system) ingest** → reconciliation outputs matching what `scripts/merge-published-catalog.ts` consumes (real offerings, and sections/meetings + grade signals when you have sources), then **merge + publish** as above.

Treat a school as **`dataTier: "institutional"`** in `data/expansion-priority.json` only when that depth is actually shipped (seed or merged reconcile), not merely when RMP sync ran.

### When is “Phase 3” done for the manifest?

The repo distinguishes two notions:

| Bar | Meaning |
| --- | ------- |
| **Release gate (automated)** | Every row in `data/expansion-priority.json` appears in the **merged** `etl/output/published_catalog.json` (after `npm run catalog:merge`) with offerings, is **not** `directory_ready`, meets **`dataTier` rules** (below), then is **published** to the environment the app reads. |
| **Runbook §3 (absolute)** | True registrar-grade depth school-by-school; there is always room to add sections, grades, and freshness. |

**`dataTier` rules enforced by `npm run catalog:audit:phase3`:**

- **`rmp_national`:** `plannerReadiness` above `directory_ready`, at least one offering (or manifest `minOfferings`), and **`hasRmp`** in the enriched snapshot (materialize + merge must have landed RMP-backed rows).
- **`institutional`:** same breadth checks at catalog tier (`catalog_ready` or better is OK). Add **`--strict-institutional`** to require **`schedule_ready` or `evidence_ready`** for every institutional manifest row (runbook §3 proxy).

**Workflow:** `npm run catalog:merge` → `npm run catalog:audit:phase3` → fix any FAIL rows (RMP pipeline, reconcile, seed, or institutional ingest) → `npm run catalog:publish:supabase` (or deploy file fallback) → re-audit if needed. Optional: `npm run catalog:audit:phase3 -- --strict-institutional` before claiming full registrar depth for the institutional cohort.

## 4. Useful diagnostics

- `npm run catalog:expansion-reconcile-status` — reconcile / expansion snapshot status
- `npm run catalog:expansion-report` — expansion report artifact (when wired to your merge output)
- `npm run catalog:audit:phase3` — pass/fail gate: manifest vs merged `published_catalog.json` (`--strict-institutional` optional)
- `npm run catalog:doctor:supabase` — published catalog health against Supabase

## 5. Env quick reference

- **RMP bulk sync:** `RMP_GRAPHQL_ENDPOINT` (see `.env.example` if present).
- **Supabase publish:** follow existing publish scripts and project env (service role / URL as already documented for the repo).

## 6. Supabase published schema (DB-first reads)

If logs show `published_catalog_db_required_tables_unavailable` or `npm run catalog:doctor:supabase` reports missing **required** tables (`schools`, `professors`, `courses`, `published_professor_course_summaries`), the app falls back to `published_catalog.json` / seed until the database matches the app’s expectations.

**Repair order (SQL Editor; all scripts are safe to re-run where noted):**

1. **`db/supabase_published_catalog.sql`** — creates the published-catalog tables, indexes, RLS policies for read-mostly public data.
2. **`db/supabase_repair_current_drift.sql`** — control/user/helper tables and `schools` column drift; requires `public.schools` from step 1.
3. **`npm run catalog:publish:supabase`** — load rows from a merged catalog (after `npm run catalog:merge`). Validate with **`npm run catalog:validate:supabase`**.

Optional: **`db/supabase_user_data.sql`** if auth-scoped user tables are not yet applied.
