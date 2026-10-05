import { expect, test } from "@playwright/test";

import {
  EMAIL_SEEKER_NAME,
  EMAIL_SEEKER_PASSWORD,
  EMAIL_SEEKER_RESET_PASSWORD,
  uniqueSeekerEmail,
} from "../helpers/accounts";
import { EMAIL_AUTH_COPY } from "../helpers/copy";
import { logByteCursor, waitForLoggedEmailAppUrl } from "../helpers/dev-email-log";
import {
  expectGenericLoginFailure,
  expectGoogleSignInVisible,
  expectGoogleSignUpVisible,
  expectSignedIn,
  openSignIn,
  openSignUp,
  signOut,
  submitEmailSignIn,
  submitEmailSignUp,
  submitForgotPassword,
  submitResetPassword,
} from "../helpers/email-auth";
import { AUTH_PATHS } from "../helpers/routes";
import { EMAIL_AUTH_JOURNEY_TIMEOUT_MS } from "../helpers/timeouts";

test.describe("email sign-up and log-in journey", () => {
  test("Google sign-in still renders on email auth screens", async ({ page }) => {
    await openSignIn(page);
    await expectGoogleSignInVisible(page);

    await openSignUp(page);
    await expectGoogleSignUpVisible(page);
  });

  test("sign-up, verify, log-in, log-out, and password reset", async ({ page }) => {
    test.setTimeout(EMAIL_AUTH_JOURNEY_TIMEOUT_MS);
    const email = uniqueSeekerEmail();
    const account = { name: EMAIL_SEEKER_NAME, email, password: EMAIL_SEEKER_PASSWORD };

    await openSignUp(page);
    await expectGoogleSignUpVisible(page);
    const verifyCursor = await logByteCursor();
    await submitEmailSignUp(page, account);

    await openSignIn(page);
    await submitEmailSignIn(page, account);
    await expectGenericLoginFailure(page);

    const verifyUrl = await waitForLoggedEmailAppUrl({
      kind: "verification",
      to: email,
      afterByte: verifyCursor,
    });
    await page.goto(verifyUrl);
    await expect(page.getByRole("heading", { name: EMAIL_AUTH_COPY.verifyHeading })).toBeVisible();
    await expect(page.getByRole("status", { name: EMAIL_AUTH_COPY.verifySuccess })).toBeVisible();
    await page.getByRole("link", { name: EMAIL_AUTH_COPY.continueToSignIn }).click();

    await expect(page.getByRole("heading", { name: EMAIL_AUTH_COPY.signInHeading })).toBeVisible();
    await expectGoogleSignInVisible(page);
    await submitEmailSignIn(page, account);
    await expect(page).toHaveURL(new RegExp(`${AUTH_PATHS.search}$`));
    await expectSignedIn(page);

    await signOut(page);

    const resetCursor = await logByteCursor();
    await submitForgotPassword(page, email);
    const resetUrl = await waitForLoggedEmailAppUrl({
      kind: "reset",
      to: email,
      afterByte: resetCursor,
    });
    await page.goto(resetUrl);
    await submitResetPassword(page, EMAIL_SEEKER_RESET_PASSWORD);

    await submitEmailSignIn(page, account);
    await expectGenericLoginFailure(page);

    await submitEmailSignIn(page, { email, password: EMAIL_SEEKER_RESET_PASSWORD });
    await expectSignedIn(page);
  });
});
