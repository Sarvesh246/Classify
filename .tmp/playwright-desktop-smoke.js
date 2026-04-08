async (page) => {
  const routes = [
    { path: "/", waitFor: "h1", waitOrder: "last" },
    { path: "/search", waitFor: "h1", waitOrder: "last" },
    { path: "/compare", waitFor: 'input[placeholder*="Texas A&M" i]', waitOrder: "first" },
    { path: "/saved", waitFor: "h1", waitOrder: "first" },
    { path: "/login", waitFor: "h1", waitOrder: "first" },
    { path: "/schools/texas-am", waitFor: "h1", waitOrder: "first" },
    { path: "/schools/texas-am/instructors", waitFor: "h1", waitOrder: "first" },
    { path: "/schools/texas-am/professors/altemose-a", waitFor: "h1", waitOrder: "first" },
    { path: "/schools/texas-am/my-courses", waitFor: "h1", waitOrder: "first" },
  ];

  const pageErrors = [];
  page.on("pageerror", (err) => {
    pageErrors.push(String(err?.message ?? err));
  });

  await page.setViewportSize({ width: 1440, height: 1200 });

  const results = [];

  for (const route of routes) {
    const consoleErrors = [];
    const handler = (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    };

    page.on("console", handler);
    pageErrors.length = 0;

    try {
      const waitLocator =
        route.waitOrder === "last"
          ? page.locator(route.waitFor).last()
          : page.locator(route.waitFor).first();
      await page.goto(`http://127.0.0.1:3200${route.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await waitLocator.waitFor({
        state: "visible",
        timeout: 20_000,
      });
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(350);

      results.push({
        path: route.path,
        url: page.url(),
        title: await page.title(),
        h1: await page.locator("h1").first().textContent().catch(() => null),
        consoleErrors,
        pageErrors: [...pageErrors],
        offlineRoute: page.url().includes("/offline"),
      });
    } catch (error) {
      results.push({
        path: route.path,
        url: page.url(),
        failed: String(error?.message ?? error),
        consoleErrors,
        pageErrors: [...pageErrors],
      });
    } finally {
      page.off("console", handler);
    }
  }

  const search = {};
  try {
    await page.goto("http://127.0.0.1:3200/search", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    const searchInput = page.locator('input[aria-autocomplete="list"]').last();
    await searchInput.waitFor({
      state: "visible",
      timeout: 20_000,
    });
    await searchInput.click();
    await searchInput.fill("Texas A&M");
    await page.waitForTimeout(900);

    const searchPanel = page.locator("text=Schools").first();
    await searchPanel.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});

    const inputBox = await searchInput.boundingBox();
    const panelBox = await page
      .locator(".soft-panel")
      .filter({ has: page.locator("text=Schools") })
      .last()
      .boundingBox()
      .catch(() => null);

    const liveUrl = page.url();
    const suggestionLinks = await page
      .locator('a[href*="/schools/"], a[href*="/professors/"], a[href*="/courses/"]')
      .evaluateAll((nodes) =>
        nodes.slice(0, 8).map((node) => ({
          text: node.textContent?.replace(/\s+/g, " ").trim() ?? "",
          href: node.getAttribute("href") ?? "",
        })),
      );

    const schoolResult = suggestionLinks.find((item) => item.href.startsWith("/schools/"));
    Object.assign(search, {
      liveUrl,
      inputBox,
      panelBox,
      suggestionLinks,
      firstSchoolResult: schoolResult ?? null,
    });
  } catch (error) {
    Object.assign(search, {
      failed: String(error?.message ?? error),
    });
  }

  return {
    routes: results,
    search,
  };
}
