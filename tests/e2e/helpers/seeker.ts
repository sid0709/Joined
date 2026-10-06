import { expect, type Page } from "@playwright/test";

import { EMAIL_SEEKER_NAME, EMAIL_SEEKER_PASSWORD, uniqueSeekerEmail } from "./accounts";
import { EMAIL_AUTH_COPY } from "./copy";
import { logByteCursor, waitForLoggedEmailAppUrl } from "./dev-email-log";
import { expectSignedIn, openSignUp, submitEmailSignIn, submitEmailSignUp } from "./email-auth";

/** Sign up through the log email sender and land signed in. */
export async function signInFreshSeeker(page: Page) {
  const email = uniqueSeekerEmail();
  const account = { name: EMAIL_SEEKER_NAME, email, password: EMAIL_SEEKER_PASSWORD };
  await openSignUp(page);
  const cursor = await logByteCursor();
  await submitEmailSignUp(page, account);
  const verifyUrl = await waitForLoggedEmailAppUrl({
    kind: "verification",
    to: email,
    afterByte: cursor,
  });
  await page.goto(verifyUrl);
  await page.getByRole("link", { name: EMAIL_AUTH_COPY.continueToSignIn }).click();
  await expect(page.getByRole("heading", { name: EMAIL_AUTH_COPY.signInHeading })).toBeVisible();
  await submitEmailSignIn(page, account);
  await expectSignedIn(page);
  return account;
}
