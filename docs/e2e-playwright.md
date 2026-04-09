# Playwright E2E

## Commands

| Command | Purpose |
|--------|---------|
| `npm run test:e2e` | Core route + search behavior (Chromium + Mobile Safari). Starts dev server locally unless `PW_SKIP_WEB_SERVER=1`. |
| `npm run test:e2e:ci` | Production-style: `next build`, then Playwright with `CI=true` (`next start` on port 3000). Use in CI. |
| `npm run test:e2e:visual` | Desktop Chromium only; runs `visual-smoke.e2e.ts` with `PLAYWRIGHT_VISUAL=1`. |

Override base URL: `PLAYWRIGHT_BASE_URL=https://staging.example.com npx playwright test` (set `PW_SKIP_WEB_SERVER=1` when the app is already running).

## Visual screenshot baselines

Default `test:e2e` skips heavy PNG assertions so CI does not fail without committed snapshots.

1. Set `PLAYWRIGHT_VISUAL=1` (or run `npm run test:e2e:visual`).
2. Update PNGs after intentional UI changes:

   `npx playwright test tests/e2e/visual-smoke.e2e.ts --project=chromium --update-snapshots`

3. Commit files under `tests/e2e/**/__snapshots__/`.

Configuration: `playwright.config.ts` (desktop Chromium + iPhone 13 WebKit; visual spec ignored on WebKit).
