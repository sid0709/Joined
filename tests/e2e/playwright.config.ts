import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke harness for Joined platform.
 * Targets local services; must run while dev services are up.
 */
export default defineConfig({
  testDir: "./specs",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
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
  webServer: process.env.CI
    ? undefined
    : {
        command: "echo 'E2E tests expect services to be running. Start with: bun run dev'",
        timeout: 1000,
        reuseExistingServer: true,
      },
});
