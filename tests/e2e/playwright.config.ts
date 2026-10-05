import { defineConfig, devices } from "@playwright/test";

import { JOINED_FRONTEND_ORIGIN } from "./helpers/origins";

const isCI = !!(process.env as Record<string, string | undefined>)["CI"];

/**
 * E2E smoke harness for Joined platform.
 * Targets local services; must run while dev services are up.
 * The email journey reads verify/reset links from the log email sender
 * (`JOINED_BACKEND_LOG`, default `/tmp/joined-backend-e2e.log`).
 */
export default defineConfig({
  testDir: "./specs",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [["html", { outputFolder: `${process.cwd()}/playwright-report` }]],
  use: {
    baseURL: JOINED_FRONTEND_ORIGIN,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: isCI
    ? undefined
    : {
        command: "echo 'E2E tests expect services to be running. Start with: bun run dev'",
        timeout: 1000,
        reuseExistingServer: true,
      },
});
