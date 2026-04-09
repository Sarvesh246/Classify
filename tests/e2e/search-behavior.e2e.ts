import { expect, test } from "@playwright/test";

test.describe("search combobox (desktop)", () => {
  test("typing a school query surfaces a canonical first result", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "Mobile Safari", "desktop combobox only");
    await page.goto("/search", { waitUntil: "networkidle" });

    const input = page.getByTestId("search-combobox-input");
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.fill("Texas A&M");
    await expect(page.getByTestId("search-result-row").first()).toBeVisible({
      timeout: 30_000,
    });
    const first = page.getByTestId("search-result-row").first();
    await expect(first).toContainText(/Texas A&M/i);
  });
});
