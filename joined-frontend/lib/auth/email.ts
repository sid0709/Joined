import { ROUTES } from "@/lib/routes";

/** Email + password auth, aligned with step-03 `/v1/auth/*` and the log sender links. */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_NAME_LENGTH = 80;
export const AUTH_TOKEN_PARAM = "token";
export const AUTH_EMAIL_PARAM = "email";
export const RESET_NOTICE_PARAM = "reset";
export const RESET_NOTICE_VALUE = "1";

export const EMAIL_API_PATHS = {
  signup: "/v1/auth/signup",
  signin: "/v1/auth/signin",
  verify: "/v1/auth/verify",
  resetRequest: "/v1/auth/password/reset-request",
  reset: "/v1/auth/password/reset",
} as const;

export const EMAIL_APP_ROUTES = {
  signup: "/api/auth/signup",
  signin: "/api/auth/signin",
  verify: "/api/auth/verify",
  resetRequest: "/api/auth/password/reset-request",
  reset: "/api/auth/password/reset",
} as const;

export const EMAIL_MESSAGES = {
  signupSuccess: "Check your email to verify your account.",
  checkEmail:
    "If you can use this address, open the verification link we sent. Check spam if it is not in your inbox.",
  loginFailed: "Email or password is incorrect.",
  loginBusy: "Could not sign in right now. Try again shortly.",
  loginUnavailable: "Email sign-in is not available right now. Try again later.",
  forgotSuccess: "If that email is registered, a password reset link has been sent.",
  verifySuccess: "Email verified. You can now sign in.",
  verifyFailed: "This link is expired or invalid.",
  verifyMissing: "This verification link is missing a token.",
  resetSuccess: "Password has been reset. Sign in with your new password.",
  resetFailed: "This link is expired or invalid.",
  resetMissing: "This reset link is missing a token.",
  weakPassword: "Password must be at least 8 characters.",
  nameRequired: "Enter your name.",
  nameTooLong: "Name must be 80 characters or fewer.",
  emailRequired: "Enter your email.",
  emailInvalid: "Enter a valid email.",
  passwordRequired: "Enter a password.",
  passwordMismatch: "Passwords do not match.",
  formInvalid: "Check the form and try again.",
  signupUnavailable: "Email sign-up is not available right now. Try again later.",
  forgotUnavailable: "Password reset is not available right now. Try again later.",
  genericFailure: "Something went wrong. Try again.",
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEAK_PASSWORD_ERROR = "password must be at least 8 characters";
const FORM_INVALID_ERROR = "check the form and try again";

export type AccountMode = "candidate" | "employee";
export type EmailAuthAction = "signup" | "signin" | "forgot" | "verify" | "reset";

export type EmailCredentials = {
  email: string;
  password: string;
};

export type SignupInput = EmailCredentials & {
  name: string;
};

export type ResetInput = {
  token: string;
  newPassword: string;
};

export type FieldStatus = { type: "error"; message: string };

export function fieldStatus(message: string | undefined): FieldStatus | undefined {
  return message ? { type: "error", message } : undefined;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function validateName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return EMAIL_MESSAGES.nameRequired;
  if ([...name].length > MAX_NAME_LENGTH) return EMAIL_MESSAGES.nameTooLong;
  return undefined;
}

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return EMAIL_MESSAGES.emailRequired;
  if (!isValidEmail(email)) return EMAIL_MESSAGES.emailInvalid;
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return EMAIL_MESSAGES.passwordRequired;
  if (value.length < MIN_PASSWORD_LENGTH) return EMAIL_MESSAGES.weakPassword;
  return undefined;
}

export function validatePasswordConfirm(password: string, confirm: string): string | undefined {
  if (!confirm) return EMAIL_MESSAGES.passwordRequired;
  if (password !== confirm) return EMAIL_MESSAGES.passwordMismatch;
  return undefined;
}

export function allowEmailSignup(mode: AccountMode): boolean {
  return mode === "candidate";
}

export function checkEmailHref(email: string) {
  return `${ROUTES.checkEmail}?${AUTH_EMAIL_PARAM}=${encodeURIComponent(email)}`;
}

export function signupRequest({ name, email, password }: SignupInput): SignupInput {
  return { name: name.trim(), email: email.trim(), password };
}

export function signinRequest({ email, password }: EmailCredentials): EmailCredentials {
  return { email: email.trim(), password };
}

export function forgotRequest(email: string): { email: string } {
  return { email: email.trim() };
}

export function verifyRequest(token: string): { token: string } {
  return { token: token.trim() };
}

export function resetRequest({ token, newPassword }: ResetInput): ResetInput {
  return { token: token.trim(), newPassword };
}

function readString(body: unknown, key: string): string {
  if (!body || typeof body !== "object") return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function parseSignupInput(
  body: unknown,
): { ok: true; value: SignupInput } | { ok: false; message: string } {
  const name = readString(body, "name");
  const email = readString(body, "email");
  const password = readString(body, "password");
  const message =
    validateName(name) ?? validateEmail(email) ?? validatePassword(password) ?? undefined;
  if (message) return { ok: false, message };
  return { ok: true, value: signupRequest({ name, email, password }) };
}

export function parseSigninInput(
  body: unknown,
): { ok: true; value: EmailCredentials } | { ok: false; message: string } {
  const email = readString(body, "email");
  const password = readString(body, "password");
  const message = validateEmail(email) ?? validatePassword(password);
  if (message) return { ok: false, message };
  return { ok: true, value: signinRequest({ email, password }) };
}

export function parseForgotInput(
  body: unknown,
): { ok: true; value: { email: string } } | { ok: false; message: string } {
  const email = readString(body, "email");
  const message = validateEmail(email);
  if (message) return { ok: false, message };
  return { ok: true, value: forgotRequest(email) };
}

export function parseVerifyInput(
  body: unknown,
): { ok: true; value: { token: string } } | { ok: false; message: string } {
  const token = readString(body, "token").trim();
  if (!token) return { ok: false, message: EMAIL_MESSAGES.verifyMissing };
  return { ok: true, value: verifyRequest(token) };
}

export function parseResetInput(
  body: unknown,
): { ok: true; value: ResetInput } | { ok: false; message: string } {
  const token = readString(body, "token").trim();
  const newPassword = readString(body, "newPassword");
  if (!token) return { ok: false, message: EMAIL_MESSAGES.resetMissing };
  const message = validatePassword(newPassword);
  if (message) return { ok: false, message };
  return { ok: true, value: resetRequest({ token, newPassword }) };
}

function backendValidationMessage(backendError: string, fallback: string): string {
  const error = backendError.trim().toLowerCase();
  if (error === WEAK_PASSWORD_ERROR) return EMAIL_MESSAGES.weakPassword;
  if (error === FORM_INVALID_ERROR) return EMAIL_MESSAGES.formInvalid;
  return fallback;
}

export function emailAuthUserMessage(
  action: EmailAuthAction,
  status: number,
  backendError = "",
): string {
  switch (action) {
    case "signup":
      if (status === 400) return backendValidationMessage(backendError, EMAIL_MESSAGES.formInvalid);
      if (status === 503) return EMAIL_MESSAGES.signupUnavailable;
      return EMAIL_MESSAGES.genericFailure;
    case "signin":
      if (status === 400) return EMAIL_MESSAGES.formInvalid;
      if (status === 401 || status === 403) return EMAIL_MESSAGES.loginFailed;
      if (status === 429) return EMAIL_MESSAGES.loginBusy;
      if (status === 503) return EMAIL_MESSAGES.loginUnavailable;
      return EMAIL_MESSAGES.genericFailure;
    case "forgot":
      if (status === 400) return EMAIL_MESSAGES.formInvalid;
      if (status === 503) return EMAIL_MESSAGES.forgotUnavailable;
      return EMAIL_MESSAGES.genericFailure;
    case "verify":
      if (status === 400 || status === 404) return EMAIL_MESSAGES.verifyFailed;
      if (status === 503) return EMAIL_MESSAGES.genericFailure;
      return EMAIL_MESSAGES.genericFailure;
    case "reset":
      if (status === 400) return backendValidationMessage(backendError, EMAIL_MESSAGES.resetFailed);
      if (status === 404) return EMAIL_MESSAGES.resetFailed;
      if (status === 503) return EMAIL_MESSAGES.forgotUnavailable;
      return EMAIL_MESSAGES.genericFailure;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

export async function submitEmailAuth(
  route: string,
  body: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      return {
        ok: false,
        message:
          typeof data.error === "string" && data.error ? data.error : EMAIL_MESSAGES.genericFailure,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: EMAIL_MESSAGES.genericFailure };
  }
}
