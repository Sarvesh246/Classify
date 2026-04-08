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

## Learned Workspace Facts

- The Next.js dev indicator “Cache disabled” reflects `next dev` behavior, not broken `cacheComponents` or `"use cache"` usage; validate caching with `next build` / `next start` or production.
- `three` is pinned to `0.182.0` to avoid `THREE.Clock` deprecation console noise until `@react-three/fiber` moves off `Clock` internally.
- Home “National school graph” spotlights use `getSchoolsForHomeNationalGraphSpotlights()` in `lib/catalog.ts` with `HOME_NATIONAL_GRAPH_PRIMARY_SLUG` (`texas-am`), up to eight schools whose `plannerReadiness` is `catalog_ready`, `schedule_ready`, or `evidence_ready`.
- School depth is `supportProfile.plannerReadiness` from `buildSchoolSupportProfile` in `lib/catalog.ts`; `directory_ready` is directory/search-only until merged catalog rows exist.
- Published data path: merge the catalog (`npm run catalog:merge`, artifact under `etl/output/`), then publish to Supabase with the repo publish flow when using remote storage.
