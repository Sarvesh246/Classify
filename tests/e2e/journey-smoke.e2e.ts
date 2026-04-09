import { expect, test } from "@playwright/test";

/**
 * Critical path: home chrome → search route → school hub from query results.
 * Uses `/search?q=` so results render from the server when the typeahead API is slow or empty in dev.
 */
test.describe("critical journey", () => {
  test("home → search nav → Texas A&M from results → school hub", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: /^Search$/i }).first().click();
    await expect(page).toHaveURL(/\/search/, { timeout: 15_000 });

    await page.goto("/search?q=Texas+A%26M", { waitUntil: "domcontentloaded" });

    const schoolLink = page.locator('a[href="/schools/texas-am"]').first();
    await expect(schoolLink).toBeVisible({ timeout: 60_000 });
    await schoolLink.click();

    await expect(page).toHaveURL(/\/schools\/texas-am/i, { timeout: 30_000 });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
  });
});
