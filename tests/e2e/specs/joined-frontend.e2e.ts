import { test, expect } from "@playwright/test";

test.describe("joined-frontend smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("http://localhost:6002");
    await expect(page).toHaveTitle(/Joined/i);
    await page.waitForLoadState("networkidle");
  });

  test("search page loads", async ({ page }) => {
    // ROUTES.search is "/" — job search is the public home route.
    await page.goto("http://localhost:6002/");
    await expect(page.getByRole("search", { name: "Search jobs" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Find your next role" })).toBeVisible();
  });

  test("/company redirects to / when company mode is off", async ({ page }) => {
    await page.goto("http://localhost:6002/company");
    await expect(page).toHaveURL("http://localhost:6002/");
  });
});
