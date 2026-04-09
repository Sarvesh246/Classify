---
description: 
alwaysApply: true
---

## Execution Workflow
For non-trivial tasks, first form an internal plan based on:
- product goals
- likely user expectations
- technical constraints
- edge cases
- UI structure
- system architecture

Then implement from that plan.

Do not jump into code blindly.
Think through the structure first, then build.

## Project-Specific Directives
This project must not feel like a reused template from prior work.
Derive the product structure, information hierarchy, interaction model, and visual language from the idea itself.

For this project, optimize for:
- [insert what matters most, like trust / speed / delight / simplicity / premium feel]
- [insert target user]
- [insert main user action]
- [insert product tone]

Avoid:
- [insert patterns you do not want]
- [insert overused styles]
- [insert common mistakes]

The final result should feel like a distinct, original product built specifically for this idea.

## Learned User Preferences

- Restore missing or empty `.env.local` from `.env.example` (variable names) and provider dashboards (values); ignored env files are not in git.
- Home should look the same after client-side navigation back to `/` as on first load (dark hero shell, hero scroll position, WebGL background when the device supports it).
- Default site experience is dark mode; users can set their preferred default theme in profile (including light if they want).
- For UI/UX-scoped product work, do not change ETL, catalog merge pipelines, scrape/source engines, or data quality.
- Keep GitHub/Vercel publishes to app source and shared config; ignore (and `git rm --cached` if already tracked) local build caches, Playwright/e2e output, scratch logs, temp screenshots, and IDE hook state under `.cursor/hooks/state/`.
- Coverage/evidence tier pills in dense rows (e.g. home featured picks) should stay on one line; avoid multi-line wrapped badge labels.
- Expect snappy client-side navigation between major routes (e.g. home and search); avoid heavy synchronous work on each transition.

## Learned Workspace Facts

- The Next.js dev indicator “Cache disabled” reflects `next dev` behavior, not broken `cacheComponents` or `"use cache"` usage; validate caching with `next build` / `next start` or production.
- `three` is pinned to `0.182.0` to avoid `THREE.Clock` deprecation console noise until `@react-three/fiber` moves off `Clock` internally.
- Home “National school graph” spotlights use `getSchoolsForHomeNationalGraphSpotlights()` in `lib/catalog.ts` with `HOME_NATIONAL_GRAPH_PRIMARY_SLUG` (`texas-am`), up to eight schools whose `plannerReadiness` is `catalog_ready`, `schedule_ready`, or `evidence_ready`.
- School depth is `supportProfile.plannerReadiness` from `buildSchoolSupportProfile` in `lib/catalog.ts`; `directory_ready` is directory/search-only until merged catalog rows exist.
- Published data path: merge the catalog (`npm run catalog:merge`, artifact under `etl/output/`), then publish to Supabase with the repo publish flow when using remote storage.
- Step-by-step catalog depth (directory → RMP national → institutional): [docs/catalog-support-runbook.md](docs/catalog-support-runbook.md).
- When the published DB snapshot is missing or empty on the server, school directory fallback reads the committed College Scorecard bundle `data/college_scorecard_schools.json` (`SCORECARD_DIRECTORY_DATA_BUNDLE_PATH` in `lib/scorecard-directory.ts`); relying only on `etl/output/college_scorecard_schools.json` fails on Vercel because that ETL output path is not in the deployment bundle.
- School search performance: narrow directory candidates with `prefilterSchoolsByTextQuery` (`lib/school-search-prefilter.ts`) before heavy scoring, and for school-only flows avoid mapping the full offerings list (e.g. distinct school slugs / lighter paths instead of `getCatalogOfferings()` for every row).
- Expanding RMP-backed national breadth: add verified `directory-slug` → numeric legacy id mappings in `data/rmp_school_legacy_ids.json` from each school’s RateMyProfessors page; do not guess ids (mis-mapped ids produce bad professor matches).
- Prerender can fail with "Filling a cache during prerender timed out" when `"use cache"` scopes are **nested** across the same heavy snapshot paths (e.g. a cached hub calling another cached directory helper); remove redundant inner boundaries and confirm with `next build`. Separately, avoid `cookies()`, `headers()`, or dynamic route args inside cached scopes—Next surfaces a similar error for those cases.
