import { expect, test, type Page } from "@playwright/test";

async function attachPageErrorGuards(page: Page) {
  const uncaught: string[] = [];
  page.on("pageerror", (err) => {
    uncaught.push(err.message);
  });
  return () => {
    expect(
      uncaught,
      uncaught.length ? uncaught.join("\n") : undefined,
    ).toHaveLength(0);
  };
}

test.describe("search combobox", () => {
  test("typing a school query surfaces a canonical first result (no page errors)", async ({
    page,
  }) => {
    const assertNoPageErrors = await attachPageErrorGuards(page);

    await page.goto("/search", { waitUntil: "networkidle" });

    const input = page.getByTestId("search-combobox-input");
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.fill("Texas A&M");
    await expect(page.getByTestId("search-result-row").first()).toBeVisible({
      timeout: 30_000,
    });
    const first = page.getByTestId("search-result-row").first();
    await expect(first).toContainText(/Texas A&M/i);

    assertNoPageErrors();
  });
});
