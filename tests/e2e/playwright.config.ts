import { defineConfig, devices } from "@playwright/test";

const isCI = !!(process.env as Record<string, string | undefined>)["CI"];

/**
 * E2E smoke harness for Joined platform.
 * Targets local services; must run while dev services are up.
 */
export default defineConfig({
  testDir: "./specs",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [["html", { outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:6002",
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
