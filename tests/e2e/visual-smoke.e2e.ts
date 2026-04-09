import { expect, test } from "@playwright/test";

/**
 * Screenshot baselines: `set PLAYWRIGHT_VISUAL=1` then
 * `npx playwright test tests/e2e/visual-smoke.e2e.ts --project=chromium --update-snapshots`
 * Commit generated PNGs. Skipped in default `npm run test:e2e` to avoid CI flake without baselines.
 */
const describeVisual = process.env.PLAYWRIGHT_VISUAL ? test.describe : test.describe.skip;

describeVisual("visual smoke", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("home hero", async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== "chromium", "desktop chromium snapshots only");
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("main")).toBeVisible();
    await expect(page).toHaveScreenshot(`home-${testInfo.project.name}.png`, {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    });
  });

  test("search page shell", async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== "chromium", "desktop chromium snapshots only");
    await page.goto("/search", { waitUntil: "networkidle" });
    await expect(page.locator("main")).toBeVisible();
    await expect(page).toHaveScreenshot(`search-${testInfo.project.name}.png`, {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 900 },
    });
  });
});
