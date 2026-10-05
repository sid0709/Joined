import { afterEach, describe, expect, mock, test } from "bun:test";
import { AUTH_PAGE_PATHS, ROUTES, signInHref } from "@/lib/routes";
import {
  EMAIL_APP_ROUTES,
  EMAIL_MESSAGES,
  RESET_NOTICE_PARAM,
  RESET_NOTICE_VALUE,
  allowEmailSignup,
  checkEmailHref,
  emailAuthUserMessage,
  fieldStatus,
  forgotRequest,
  isValidEmail,
  parseForgotInput,
  parseResetInput,
  parseSigninInput,
  parseSignupInput,
  parseVerifyInput,
  resetRequest,
  signinRequest,
  signupRequest,
  submitEmailAuth,
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirm,
  verifyRequest,
} from "./email";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("email validation", () => {
  test("accepts a normal address and rejects empty or malformed ones", () => {
    expect(isValidEmail("ada@example.com")).toBe(true);
    expect(isValidEmail("  ada@example.com  ")).toBe(true);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("ada")).toBe(false);
    expect(isValidEmail("ada@example")).toBe(false);
    expect(validateEmail("")).toBe(EMAIL_MESSAGES.emailRequired);
    expect(validateEmail("ada")).toBe(EMAIL_MESSAGES.emailInvalid);
    expect(validateEmail("ada@example.com")).toBeUndefined();
  });

  test("requires a name of at most 80 characters", () => {
    expect(validateName("")).toBe(EMAIL_MESSAGES.nameRequired);
    expect(validateName("   ")).toBe(EMAIL_MESSAGES.nameRequired);
    expect(validateName("Ada")).toBeUndefined();
    expect(validateName("é".repeat(80))).toBeUndefined();
    expect(validateName("é".repeat(81))).toBe(EMAIL_MESSAGES.nameTooLong);
  });

  test("requires a password of at least 8 characters", () => {
    expect(validatePassword("")).toBe(EMAIL_MESSAGES.passwordRequired);
    expect(validatePassword("short")).toBe(EMAIL_MESSAGES.weakPassword);
    expect(validatePassword("password123")).toBeUndefined();
    expect(validatePasswordConfirm("password123", "")).toBe(EMAIL_MESSAGES.passwordRequired);
    expect(validatePasswordConfirm("password123", "otherpass")).toBe(
      EMAIL_MESSAGES.passwordMismatch,
    );
    expect(validatePasswordConfirm("password123", "password123")).toBeUndefined();
  });
});

describe("email request builders", () => {
  test("signup never sends a company or employer role", () => {
    const body = signupRequest({
      name: "  Ada Lovelace  ",
      email: " ada@example.com ",
      password: "password123",
    });
    expect(body).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "password123",
    });
    expect(body).not.toHaveProperty("role");
    expect(allowEmailSignup("candidate")).toBe(true);
    expect(allowEmailSignup("employee")).toBe(false);
  });

  test("trims sign-in, forgot, verify, and reset payloads", () => {
    expect(signinRequest({ email: " ada@example.com ", password: "password123" })).toEqual({
      email: "ada@example.com",
      password: "password123",
    });
    expect(forgotRequest(" ada@example.com ")).toEqual({ email: "ada@example.com" });
    expect(verifyRequest("  token  ")).toEqual({ token: "token" });
    expect(resetRequest({ token: "  token  ", newPassword: "newpass12" })).toEqual({
      token: "token",
      newPassword: "newpass12",
    });
  });
});

describe("email body parsers", () => {
  test("parseSignupInput requires name, email, and a strong password", () => {
    expect(parseSignupInput(null).ok).toBe(false);
    expect(parseSignupInput({ email: "ada@example.com", password: "password123" }).ok).toBe(false);
    expect(parseSignupInput({ name: "Ada", email: "ada", password: "password123" }).ok).toBe(false);
    expect(parseSignupInput({ name: "Ada", email: "ada@example.com", password: "short" }).ok).toBe(
      false,
    );
    const parsed = parseSignupInput({
      name: "Ada",
      email: "ada@example.com",
      password: "password123",
      role: "employee",
    });
    expect(parsed).toEqual({
      ok: true,
      value: { name: "Ada", email: "ada@example.com", password: "password123" },
    });
    if (parsed.ok) expect(parsed.value).not.toHaveProperty("role");
  });

  test("parseSigninInput and parseForgotInput stay field-level", () => {
    expect(parseSigninInput({ email: "ada@example.com", password: "password123" }).ok).toBe(true);
    expect(parseSigninInput({ email: "ada@example.com", password: "" }).ok).toBe(false);
    expect(parseForgotInput({ email: "ada@example.com" }).ok).toBe(true);
    expect(parseForgotInput({ email: "" }).ok).toBe(false);
  });

  test("parseVerifyInput and parseResetInput require a token", () => {
    expect(parseVerifyInput({ token: "  " })).toEqual({
      ok: false,
      message: EMAIL_MESSAGES.verifyMissing,
    });
    expect(parseVerifyInput({ token: "abc" })).toEqual({ ok: true, value: { token: "abc" } });
    expect(parseResetInput({ token: "", newPassword: "password123" })).toEqual({
      ok: false,
      message: EMAIL_MESSAGES.resetMissing,
    });
    expect(parseResetInput({ token: "abc", newPassword: "short" }).ok).toBe(false);
    expect(parseResetInput({ token: "abc", newPassword: "password123" })).toEqual({
      ok: true,
      value: { token: "abc", newPassword: "password123" },
    });
  });
});

describe("enumeration-safe auth messages", () => {
  test("signup never changes copy for a duplicate account", () => {
    expect(emailAuthUserMessage("signup", 400, "password must be at least 8 characters")).toBe(
      EMAIL_MESSAGES.weakPassword,
    );
    expect(emailAuthUserMessage("signup", 400, "check the form and try again")).toBe(
      EMAIL_MESSAGES.formInvalid,
    );
    expect(emailAuthUserMessage("signup", 400, "email already taken")).toBe(
      EMAIL_MESSAGES.formInvalid,
    );
    expect(emailAuthUserMessage("signup", 503)).toBe(EMAIL_MESSAGES.signupUnavailable);
    expect(emailAuthUserMessage("signup", 500)).toBe(EMAIL_MESSAGES.genericFailure);
  });

  test("signin hides verify, missing-account, and lockout specifics", () => {
    expect(emailAuthUserMessage("signin", 401, "sign in required")).toBe(
      EMAIL_MESSAGES.loginFailed,
    );
    expect(emailAuthUserMessage("signin", 403, "please verify your email before signing in")).toBe(
      EMAIL_MESSAGES.loginFailed,
    );
    expect(
      emailAuthUserMessage("signin", 429, "too many failed attempts; try again in 15 minutes"),
    ).toBe(EMAIL_MESSAGES.loginBusy);
    expect(emailAuthUserMessage("signin", 400)).toBe(EMAIL_MESSAGES.formInvalid);
    expect(emailAuthUserMessage("signin", 503)).toBe(EMAIL_MESSAGES.loginUnavailable);
    expect(emailAuthUserMessage("signin", 500)).toBe(EMAIL_MESSAGES.genericFailure);
  });

  test("forgot, verify, and reset stay generic except for weak passwords", () => {
    expect(emailAuthUserMessage("forgot", 400)).toBe(EMAIL_MESSAGES.formInvalid);
    expect(emailAuthUserMessage("forgot", 503)).toBe(EMAIL_MESSAGES.forgotUnavailable);
    expect(emailAuthUserMessage("forgot", 500)).toBe(EMAIL_MESSAGES.genericFailure);
    expect(emailAuthUserMessage("verify", 400, "this link is expired or invalid")).toBe(
      EMAIL_MESSAGES.verifyFailed,
    );
    expect(emailAuthUserMessage("verify", 404, "account not found")).toBe(
      EMAIL_MESSAGES.verifyFailed,
    );
    expect(emailAuthUserMessage("verify", 503)).toBe(EMAIL_MESSAGES.genericFailure);
    expect(emailAuthUserMessage("verify", 500)).toBe(EMAIL_MESSAGES.genericFailure);
    expect(emailAuthUserMessage("reset", 400, "password must be at least 8 characters")).toBe(
      EMAIL_MESSAGES.weakPassword,
    );
    expect(emailAuthUserMessage("reset", 400, "this link is expired or invalid")).toBe(
      EMAIL_MESSAGES.resetFailed,
    );
    expect(emailAuthUserMessage("reset", 404)).toBe(EMAIL_MESSAGES.resetFailed);
    expect(emailAuthUserMessage("reset", 503)).toBe(EMAIL_MESSAGES.forgotUnavailable);
    expect(emailAuthUserMessage("reset", 500)).toBe(EMAIL_MESSAGES.genericFailure);
  });
});

describe("field helpers and client submit", () => {
  test("fieldStatus only appears when there is a message", () => {
    expect(fieldStatus(undefined)).toBeUndefined();
    expect(fieldStatus("Enter your email")).toEqual({ type: "error", message: "Enter your email" });
  });

  test("submitEmailAuth posts JSON and surfaces mapped errors", async () => {
    const fetchMock = mock((input: RequestInfo | URL) => {
      void input;
      return Promise.resolve(Response.json({ ok: true }, { status: 200 }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(
      await submitEmailAuth(EMAIL_APP_ROUTES.signin, { email: "a@b.co", password: "password123" }),
    ).toEqual({ ok: true });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(EMAIL_APP_ROUTES.signin);

    globalThis.fetch = mock(() =>
      Promise.resolve(Response.json({ error: EMAIL_MESSAGES.loginFailed }, { status: 401 })),
    ) as unknown as typeof fetch;
    expect(
      await submitEmailAuth(EMAIL_APP_ROUTES.signin, { email: "a@b.co", password: "wrongpass" }),
    ).toEqual({
      ok: false,
      message: EMAIL_MESSAGES.loginFailed,
    });

    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("nope", { status: 500 })),
    ) as unknown as typeof fetch;
    expect(await submitEmailAuth(EMAIL_APP_ROUTES.signup, {})).toEqual({
      ok: false,
      message: EMAIL_MESSAGES.genericFailure,
    });

    globalThis.fetch = mock(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    expect(await submitEmailAuth(EMAIL_APP_ROUTES.signup, {})).toEqual({
      ok: false,
      message: EMAIL_MESSAGES.genericFailure,
    });
  });

  test("auth page paths include the email journey", () => {
    expect(ROUTES.checkEmail).toBe("/check-email");
    expect(ROUTES.verifyEmail).toBe("/verify");
    expect(ROUTES.forgotPassword).toBe("/forgot-password");
    expect(ROUTES.resetPassword).toBe("/reset-password");
    expect(checkEmailHref("ada@example.com")).toBe("/check-email?email=ada%40example.com");
    expect(AUTH_PAGE_PATHS).toContain(ROUTES.verifyEmail);
    expect(AUTH_PAGE_PATHS).toContain(ROUTES.resetPassword);
    expect(RESET_NOTICE_PARAM).toBe("reset");
    expect(RESET_NOTICE_VALUE).toBe("1");
    expect(signInHref("/applications")).toBe("/sign-in?next=%2Fapplications");
  });
});
