import { test, expect } from "@playwright/test";

import { SCOUTWELL_FRONTEND_ORIGIN } from "../helpers/origins";

test.describe("scoutwell-frontend smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto(SCOUTWELL_FRONTEND_ORIGIN);
    await expect(page).toHaveTitle(/Scout/i);
    await page.waitForLoadState("networkidle");
  });
});
