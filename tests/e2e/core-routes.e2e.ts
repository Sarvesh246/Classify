import { expect, test } from "@playwright/test";

/** Routes that must render without a hard error for launch smoke. */
const corePaths = [
  "/",
  "/search",
  "/compare",
  "/saved",
  "/login",
  "/methodology",
  "/schools/texas-am",
  "/schools/texas-am/instructors",
  "/schools/texas-am/my-courses",
] as const;

test.describe("core routes", () => {
  for (const path of corePaths) {
    test(`${path} responds and renders main landmark`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.ok() ?? false, `HTTP for ${path}`).toBeTruthy();

      /* Home uses layered hero + app chrome; multiple <main> can exist during transition. */
      await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
    });
  }
});

test.describe("professor route (when published)", () => {
  test("/schools/texas-am/professors/altemose-a loads or 404 gracefully", async ({
    page,
  }) => {
    const response = await page.goto("/schools/texas-am/professors/altemose-a", {
      waitUntil: "domcontentloaded",
    });
    const status = response?.status() ?? 0;
    expect([200, 404]).toContain(status);
    await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
  });
});
