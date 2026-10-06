import { expect, test, type APIRequestContext } from "@playwright/test";

import { CHECKOUT_SKIP_REASON, SEEKER_COPY } from "../helpers/copy";
import { JOINED_API_ORIGIN, JOINED_FRONTEND_ORIGIN } from "../helpers/origins";
import { AUTH_PATHS, jobPath } from "../helpers/routes";
import { signInFreshSeeker } from "../helpers/seeker";
import { SEEKER_JOURNEY_TIMEOUT_MS } from "../helpers/timeouts";

type SearchJob = { id?: string };

async function firstJobId(request: APIRequestContext) {
  const response = await request.get(`${JOINED_API_ORIGIN}/v1/search/jobs`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { jobs?: SearchJob[] };
  const id = body.jobs?.find((job) => job.id)?.id;
  return id ?? "";
}

test.describe("seeker and premium journeys", () => {
  test("search loads and premium pricing stays in test mode", async ({ page, request }) => {
    await page.goto(`${JOINED_FRONTEND_ORIGIN}${AUTH_PATHS.search}`);
    await expect(page.getByRole("search", { name: SEEKER_COPY.searchRole })).toBeVisible();
    await expect(page.getByRole("heading", { name: SEEKER_COPY.searchHeading })).toBeVisible();

    const jobId = await firstJobId(request);
    if (!jobId) {
      test.info().annotations.push({
        type: "note",
        description: "search catalog returned no jobs, so the public job page was not opened",
      });
    } else {
      await page.goto(`${JOINED_FRONTEND_ORIGIN}${jobPath(jobId)}`);
      await expect(page).toHaveURL(new RegExp(`/jobs/${jobId}$`));
      await expect(page.getByRole("button", { name: SEEKER_COPY.saveJob })).toBeVisible();
    }

    await page.goto(`${JOINED_FRONTEND_ORIGIN}${AUTH_PATHS.pricing}`);
    await expect(page.getByRole("heading", { name: SEEKER_COPY.pricingHeading })).toBeVisible();
    await expect(page.getByText(SEEKER_COPY.testMode).first()).toBeVisible();
    await expect(page).not.toHaveURL(/checkout\.stripe\.com/);
    test.info().annotations.push({ type: "skip-checkout", description: CHECKOUT_SKIP_REASON });
  });

  test("a verified seeker saves a search and opens applications and billing", async ({ page }) => {
    test.setTimeout(SEEKER_JOURNEY_TIMEOUT_MS);
    await signInFreshSeeker(page);

    await page.goto(`${JOINED_FRONTEND_ORIGIN}${AUTH_PATHS.search}`);
    await page.getByRole("button", { name: SEEKER_COPY.createJobAlert }).click();
    await expect(page.getByRole("heading", { name: SEEKER_COPY.saveSearchTitle })).toBeVisible();
    await page.getByRole("textbox", { name: SEEKER_COPY.searchName }).fill("Backend roles");
    await page.getByRole("button", { name: SEEKER_COPY.saveSearch }).click();
    await expect(page.getByText("Backend roles")).toBeVisible();

    await page.goto(`${JOINED_FRONTEND_ORIGIN}${AUTH_PATHS.applications}`);
    await expect(
      page.getByRole("heading", { name: SEEKER_COPY.applicationsHeading }),
    ).toBeVisible();

    await page.goto(`${JOINED_FRONTEND_ORIGIN}${AUTH_PATHS.settingsBilling}`);
    await expect(page.getByText(SEEKER_COPY.billingTestMode)).toBeVisible();
    const paused = page.getByText(SEEKER_COPY.checkoutPaused);
    if (await paused.isVisible()) {
      test.info().annotations.push({
        type: "skip-checkout",
        description: "BILLING_CHECKOUT_ENABLED is false, so Upgrade is not offered",
      });
    } else {
      await expect(
        page
          .getByRole("link", { name: SEEKER_COPY.seePlans })
          .or(page.getByRole("button", { name: SEEKER_COPY.upgrade })),
      ).toBeVisible();
    }
    await expect(page).not.toHaveURL(/checkout\.stripe\.com/);
    test.info().annotations.push({ type: "skip-checkout", description: CHECKOUT_SKIP_REASON });
  });
});
