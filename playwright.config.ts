import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

/**
 * Core route + visual regression. Local: starts `next dev` unless PW_SKIP_WEB_SERVER=1.
 * CI: run `npm run build` first, then `npm run test:e2e:ci` (uses `next start`).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: { maxDiffPixels: 120 },
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 13"] },
      /* Visual PNG baselines are desktop-only; mobile still runs core + search specs. */
      testIgnore: /visual-smoke\.e2e\.ts/,
    },
  ],
  webServer: process.env.PW_SKIP_WEB_SERVER
    ? undefined
    : {
        command: process.env.CI
          ? "npm run start -- -p 3000 -H 127.0.0.1"
          : "npm run dev -- --port 3000 -H 127.0.0.1 --webpack",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
