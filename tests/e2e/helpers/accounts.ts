import { randomBytes } from "node:crypto";

/** Seeker used by the email journey. First name is the account-menu trigger. */

export const EMAIL_SEEKER_NAME = "Quinn";
export const EMAIL_SEEKER_PASSWORD = "seeker-pass-31";
export const EMAIL_SEEKER_RESET_PASSWORD = "seeker-pass-31-next";

const TEST_EMAIL_DOMAIN = "joined.test";

export function uniqueSeekerEmail(): string {
  const nonce = randomBytes(6).toString("hex");
  return `e2e.step31.${Date.now()}.${nonce}@${TEST_EMAIL_DOMAIN}`;
}
