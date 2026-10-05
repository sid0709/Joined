import { expect, type Page } from "@playwright/test";

import { EMAIL_SEEKER_NAME } from "./accounts";
import { EMAIL_AUTH_COPY } from "./copy";
import { AUTH_PATHS } from "./routes";
import { EMAIL_PAGE_WAIT_MS } from "./timeouts";

export async function expectGoogleSignInVisible(page: Page) {
  await expect(page.getByRole("button", { name: EMAIL_AUTH_COPY.googleSignIn })).toBeVisible();
}

export async function expectGoogleSignUpVisible(page: Page) {
  await expect(page.getByRole("button", { name: EMAIL_AUTH_COPY.googleSignUp })).toBeVisible();
}

export async function openSignUp(page: Page) {
  await page.goto(AUTH_PATHS.signUp);
  await expect(page.getByRole("heading", { name: EMAIL_AUTH_COPY.signUpHeading })).toBeVisible();
}

export async function openSignIn(page: Page) {
  await page.goto(AUTH_PATHS.signIn);
  await expect(page.getByRole("heading", { name: EMAIL_AUTH_COPY.signInHeading })).toBeVisible();
}

export async function submitEmailSignUp(
  page: Page,
  input: { name: string; email: string; password: string },
) {
  await page.getByRole("textbox", { name: EMAIL_AUTH_COPY.nameLabel }).fill(input.name);
  await page.getByRole("textbox", { name: EMAIL_AUTH_COPY.emailLabel }).fill(input.email);
  await page.getByRole("textbox", { name: EMAIL_AUTH_COPY.passwordLabel }).fill(input.password);
  await page.getByRole("button", { name: EMAIL_AUTH_COPY.createAccountEmail }).click();
  await expect(page).toHaveURL(new RegExp(AUTH_PATHS.checkEmail), { timeout: EMAIL_PAGE_WAIT_MS });
  await expect(
    page.getByRole("heading", { name: EMAIL_AUTH_COPY.checkEmailHeading }),
  ).toBeVisible();
}

export async function submitEmailSignIn(page: Page, input: { email: string; password: string }) {
  await page.getByRole("textbox", { name: EMAIL_AUTH_COPY.emailLabel }).fill(input.email);
  await page.getByRole("textbox", { name: EMAIL_AUTH_COPY.passwordLabel }).fill(input.password);
  await page.getByRole("button", { name: EMAIL_AUTH_COPY.signInEmail }).click();
}

/**
 * Astryx Banner sets `role="alert"` (error) or `role="status"` (success) on the
 * root and puts the title in a child. Those roles take an accessible name from
 * the author, not contents, so `{ name }` never matches the visible copy.
 */
export function emailBanner(page: Page, role: "alert" | "status", text: string) {
  return page.getByRole(role).filter({ hasText: text });
}

/** Unverified or wrong credentials stay on sign-in with the generic login message. */
export async function expectGenericLoginFailure(page: Page) {
  await expect(page).toHaveURL(new RegExp(`${AUTH_PATHS.signIn}(?:\\?|$)`));
  await expect(emailBanner(page, "alert", EMAIL_AUTH_COPY.loginFailed)).toBeVisible();
}

export async function expectSignedIn(page: Page) {
  await expect(page.getByRole("button", { name: EMAIL_SEEKER_NAME })).toBeVisible({
    timeout: EMAIL_PAGE_WAIT_MS,
  });
  await expect(page.getByRole("link", { name: EMAIL_AUTH_COPY.applicationsNav })).toBeVisible();
}

export async function expectSignedOut(page: Page) {
  await expect(page.getByRole("link", { name: EMAIL_AUTH_COPY.guestSignIn })).toBeVisible();
  await expect(page.getByRole("link", { name: EMAIL_AUTH_COPY.createAccount })).toBeVisible();
  await expect(page.getByRole("link", { name: EMAIL_AUTH_COPY.applicationsNav })).toHaveCount(0);
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: EMAIL_SEEKER_NAME }).click();
  await page.getByRole("menuitem", { name: EMAIL_AUTH_COPY.signOut }).click();
  await expectSignedOut(page);
}

export async function submitForgotPassword(page: Page, email: string) {
  await page.goto(AUTH_PATHS.forgotPassword);
  await expect(page.getByRole("heading", { name: EMAIL_AUTH_COPY.forgotHeading })).toBeVisible();
  await page.getByRole("textbox", { name: EMAIL_AUTH_COPY.emailLabel }).fill(email);
  await page.getByRole("button", { name: EMAIL_AUTH_COPY.sendResetLink }).click();
  await expect(emailBanner(page, "status", EMAIL_AUTH_COPY.forgotSuccess)).toBeVisible({
    timeout: EMAIL_PAGE_WAIT_MS,
  });
}

export async function submitResetPassword(page: Page, password: string) {
  await expect(page.getByRole("heading", { name: EMAIL_AUTH_COPY.resetHeading })).toBeVisible();
  await page.getByRole("textbox", { name: EMAIL_AUTH_COPY.newPasswordLabel }).fill(password);
  await page.getByRole("textbox", { name: EMAIL_AUTH_COPY.confirmPasswordLabel }).fill(password);
  await page.getByRole("button", { name: EMAIL_AUTH_COPY.resetPassword }).click();
  await expect(page.getByRole("heading", { name: EMAIL_AUTH_COPY.signInHeading })).toBeVisible({
    timeout: EMAIL_PAGE_WAIT_MS,
  });
  await expect(emailBanner(page, "status", EMAIL_AUTH_COPY.resetUpdated)).toBeVisible();
}
