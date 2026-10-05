import { test, expect } from "@playwright/test";

test.describe("joined-frontend smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("http://localhost:6002");
    await expect(page).toHaveTitle(/Joined/i);
    await page.waitForLoadState("networkidle");
  });

  test("search page loads", async ({ page }) => {
    await page.goto("http://localhost:6002/search");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test.skip("/company redirect to / when company mode is off", async ({ page }) => {
    // TODO: Enable after step-04 merges (company mode toggle).
    // await page.goto("http://localhost:6002/company");
    // await expect(page).toHaveURL("http://localhost:6002/");
  });
});
