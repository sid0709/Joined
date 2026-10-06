import { expect, test } from "@playwright/test";

import { SCOUT_COPY } from "../helpers/copy";
import { SCOUTWELL_FRONTEND_ORIGIN } from "../helpers/origins";
import { SCOUT_PATHS } from "../helpers/routes";

test.describe("scoutwell app", () => {
  test("home and sign-in render", async ({ page }) => {
    await page.goto(`${SCOUTWELL_FRONTEND_ORIGIN}${SCOUT_PATHS.home}`);
    await expect(page).toHaveTitle(SCOUT_COPY.homeTitle);

    await page.goto(`${SCOUTWELL_FRONTEND_ORIGIN}${SCOUT_PATHS.signIn}`);
    await expect(page.getByRole("heading", { name: SCOUT_COPY.signInHeading })).toBeVisible();
  });

  test("earnings and payouts send a signed-out scout to sign-in", async ({ page }) => {
    await page.goto(`${SCOUTWELL_FRONTEND_ORIGIN}${SCOUT_PATHS.earnings}`);
    await expect(page).toHaveURL(new RegExp(`${SCOUT_PATHS.signIn}(?:\\?|$)`));
    await expect(page.getByRole("heading", { name: SCOUT_COPY.signInHeading })).toBeVisible();

    await page.goto(`${SCOUTWELL_FRONTEND_ORIGIN}${SCOUT_PATHS.payouts}`);
    await expect(page).toHaveURL(new RegExp(`${SCOUT_PATHS.signIn}(?:\\?|$)`));
  });
});
