import { test, expect } from "@playwright/test";

test.describe("scoutwell-frontend smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("http://localhost:6003");
    await expect(page).toHaveTitle(/Scout/i);
    await page.waitForLoadState("networkidle");
  });
});
