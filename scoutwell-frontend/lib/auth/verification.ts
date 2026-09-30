/**
 * Email verification is frontend-only for now: no email is sent and the API does not check the code.
 * Every sign-up is accepted with this fixed code until the backend issues real ones.
 */
export const EMAIL_VERIFICATION_CODE = "123456";
export const EMAIL_VERIFICATION_CODE_LENGTH = EMAIL_VERIFICATION_CODE.length;

export function isValidVerificationCode(code: string) {
  return code === EMAIL_VERIFICATION_CODE;
}

/** Keeps only digits, capped at the code length, so pasted "123 456" still works. */
export function normalizeVerificationCode(raw: string) {
  return raw.replace(/\D/g, "").slice(0, EMAIL_VERIFICATION_CODE_LENGTH);
}
