import { expect, type Page } from "@playwright/test";

import { EMAIL_SEEKER_NAME } from "./accounts";
import { EMAIL_AUTH_COPY } from "./copy";
import { AUTH_PATHS } from "./routes";

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
  await page.getByLabel(EMAIL_AUTH_COPY.nameLabel).fill(input.name);
  await page.getByLabel(EMAIL_AUTH_COPY.emailLabel).fill(input.email);
  await page.getByLabel(EMAIL_AUTH_COPY.passwordLabel, { exact: true }).fill(input.password);
  await page.getByRole("button", { name: EMAIL_AUTH_COPY.createAccountEmail }).click();
  await expect(
    page.getByRole("heading", { name: EMAIL_AUTH_COPY.checkEmailHeading }),
  ).toBeVisible();
}

export async function submitEmailSignIn(page: Page, input: { email: string; password: string }) {
  await page.getByLabel(EMAIL_AUTH_COPY.emailLabel).fill(input.email);
  await page.getByLabel(EMAIL_AUTH_COPY.passwordLabel, { exact: true }).fill(input.password);
  await page.getByRole("button", { name: EMAIL_AUTH_COPY.signInEmail }).click();
}

/** Unverified or wrong credentials stay on sign-in with the generic login message. */
export async function expectGenericLoginFailure(page: Page) {
  await expect(page).toHaveURL(new RegExp(`${AUTH_PATHS.signIn}(?:\\?|$)`));
  await expect(page.getByRole("alert")).toHaveText(EMAIL_AUTH_COPY.loginFailed);
}

export async function expectSignedIn(page: Page) {
  await expect(page.getByRole("button", { name: EMAIL_SEEKER_NAME })).toBeVisible();
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
  await page.getByLabel(EMAIL_AUTH_COPY.emailLabel).fill(email);
  await page.getByRole("button", { name: EMAIL_AUTH_COPY.sendResetLink }).click();
  await expect(page.getByRole("status")).toHaveText(EMAIL_AUTH_COPY.forgotSuccess);
}

export async function submitResetPassword(page: Page, password: string) {
  await expect(page.getByRole("heading", { name: EMAIL_AUTH_COPY.resetHeading })).toBeVisible();
  await page.getByLabel(EMAIL_AUTH_COPY.newPasswordLabel).fill(password);
  await page.getByLabel(EMAIL_AUTH_COPY.confirmPasswordLabel).fill(password);
  await page.getByRole("button", { name: EMAIL_AUTH_COPY.resetPassword }).click();
  await expect(page.getByRole("heading", { name: EMAIL_AUTH_COPY.signInHeading })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(EMAIL_AUTH_COPY.resetUpdated);
}
