import { afterEach, describe, expect, mock, test } from "bun:test";
import { EMAIL_API_PATHS, EMAIL_MESSAGES } from "./email";
import {
  extractSessionToken,
  handleEmailSignin,
  handleEmailSignup,
  handleEmailVerify,
  handlePasswordReset,
  handlePasswordResetRequest,
  postJoinedAuth,
  verifyEmailToken,
} from "./email-api";

const API = "http://api.test";
const realFetch = globalThis.fetch;

function answer(status: number, body: unknown) {
  const fetchMock = mock((input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return Promise.resolve(Response.json(body, { status }));
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

function jsonRequest(body: unknown): Request {
  return new Request("http://app.test/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readJson(
  response: Response,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("postJoinedAuth", () => {
  test("posts JSON to the Joined auth path and returns the body", async () => {
    const fetchMock = answer(200, { message: EMAIL_MESSAGES.signupSuccess });
    const result = await postJoinedAuth(API, EMAIL_API_PATHS.signup, {
      name: "Ada",
      email: "ada@example.com",
      password: "password123",
    });
    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { message: EMAIL_MESSAGES.signupSuccess },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL(`${API}/v1/auth/signup`));
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("POST");
  });

  test("maps API errors without leaking a session token", async () => {
    answer(401, { error: "sign in required" });
    expect(
      await postJoinedAuth(API, EMAIL_API_PATHS.signin, { email: "a@b.co", password: "x" }),
    ).toEqual({
      ok: false,
      status: 401,
      error: "sign in required",
    });
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("nope", { status: 500 })),
    ) as unknown as typeof fetch;
    expect(await postJoinedAuth(API, EMAIL_API_PATHS.signin, {})).toEqual({
      ok: false,
      status: 500,
      error: "",
    });
  });
});

describe("session token and verify landing", () => {
  test("extractSessionToken only returns a string token", () => {
    expect(extractSessionToken({ token: "sess_1" })).toBe("sess_1");
    expect(extractSessionToken({})).toBe("");
    expect(extractSessionToken({ token: 12 })).toBe("");
  });

  test("verifyEmailToken calls /v1/auth/verify and maps the result", async () => {
    expect(await verifyEmailToken(API, "   ")).toEqual({
      ok: false,
      message: EMAIL_MESSAGES.verifyMissing,
    });
    const fetchMock = answer(200, { message: "Email verified successfully. You can now sign in." });
    expect(await verifyEmailToken(API, "  tok  ")).toEqual({
      ok: true,
      message: EMAIL_MESSAGES.verifySuccess,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL(`${API}/v1/auth/verify`));
    answer(400, { error: "this link is expired or invalid" });
    expect(await verifyEmailToken(API, "bad")).toEqual({
      ok: false,
      message: EMAIL_MESSAGES.verifyFailed,
    });
    answer(404, { error: "account not found" });
    expect(await verifyEmailToken(API, "gone")).toEqual({
      ok: false,
      message: EMAIL_MESSAGES.verifyFailed,
    });
    globalThis.fetch = mock(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    expect(await verifyEmailToken(API, "tok")).toEqual({
      ok: false,
      message: EMAIL_MESSAGES.genericFailure,
    });
  });
});

describe("email auth route handlers", () => {
  test("signup returns the same success copy and rejects invalid bodies", async () => {
    expect(await readJson(await handleEmailSignup(jsonRequest({}), API))).toEqual({
      status: 400,
      body: { error: EMAIL_MESSAGES.nameRequired },
    });
    answer(200, { message: "Please check your email to verify your account." });
    expect(
      await readJson(
        await handleEmailSignup(
          jsonRequest({ name: "Ada", email: "ada@example.com", password: "password123" }),
          API,
        ),
      ),
    ).toEqual({ status: 200, body: { message: EMAIL_MESSAGES.signupSuccess } });
    answer(400, { error: "password must be at least 8 characters" });
    expect(
      await readJson(
        await handleEmailSignup(
          jsonRequest({ name: "Ada", email: "ada@example.com", password: "password123" }),
          API,
        ),
      ),
    ).toEqual({ status: 400, body: { error: EMAIL_MESSAGES.weakPassword } });
    globalThis.fetch = mock(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    expect(
      await readJson(
        await handleEmailSignup(
          jsonRequest({ name: "Ada", email: "ada@example.com", password: "password123" }),
          API,
        ),
      ),
    ).toEqual({ status: 503, body: { error: EMAIL_MESSAGES.genericFailure } });
  });

  test("signin writes the session cookie and hides verify vs missing-account", async () => {
    const writeSession = mock((token: string) => {
      void token;
      return Promise.resolve();
    });
    expect(
      await readJson(await handleEmailSignin(jsonRequest({ email: "ada" }), API, writeSession)),
    ).toEqual({ status: 400, body: { error: EMAIL_MESSAGES.emailInvalid } });

    answer(200, { token: "sess_1" });
    expect(
      await readJson(
        await handleEmailSignin(
          jsonRequest({ email: "ada@example.com", password: "password123" }),
          API,
          writeSession,
        ),
      ),
    ).toEqual({ status: 200, body: { ok: true } });
    expect(writeSession.mock.calls[0]?.[0]).toBe("sess_1");

    answer(403, { error: "please verify your email before signing in" });
    expect(
      await readJson(
        await handleEmailSignin(
          jsonRequest({ email: "ada@example.com", password: "password123" }),
          API,
          writeSession,
        ),
      ),
    ).toEqual({ status: 401, body: { error: EMAIL_MESSAGES.loginFailed } });

    answer(200, { session: {} });
    expect(
      await readJson(
        await handleEmailSignin(
          jsonRequest({ email: "ada@example.com", password: "password123" }),
          API,
          writeSession,
        ),
      ),
    ).toEqual({ status: 502, body: { error: EMAIL_MESSAGES.genericFailure } });
  });

  test("verify, forgot, and reset forward mapped JSON", async () => {
    expect(await readJson(await handleEmailVerify(jsonRequest({}), API))).toEqual({
      status: 400,
      body: { error: EMAIL_MESSAGES.verifyMissing },
    });
    answer(200, { message: "ok" });
    expect(await readJson(await handleEmailVerify(jsonRequest({ token: "tok" }), API))).toEqual({
      status: 200,
      body: { message: EMAIL_MESSAGES.verifySuccess },
    });
    answer(400, { error: "this link is expired or invalid" });
    expect(await readJson(await handleEmailVerify(jsonRequest({ token: "tok" }), API))).toEqual({
      status: 400,
      body: { error: EMAIL_MESSAGES.verifyFailed },
    });

    expect(await readJson(await handlePasswordResetRequest(jsonRequest({}), API))).toEqual({
      status: 400,
      body: { error: EMAIL_MESSAGES.emailRequired },
    });
    answer(200, { message: "ok" });
    expect(
      await readJson(
        await handlePasswordResetRequest(jsonRequest({ email: "ada@example.com" }), API),
      ),
    ).toEqual({ status: 200, body: { message: EMAIL_MESSAGES.forgotSuccess } });
    answer(503, { error: "password reset is not available" });
    expect(
      await readJson(
        await handlePasswordResetRequest(jsonRequest({ email: "ada@example.com" }), API),
      ),
    ).toEqual({ status: 503, body: { error: EMAIL_MESSAGES.forgotUnavailable } });

    expect(await readJson(await handlePasswordReset(jsonRequest({}), API))).toEqual({
      status: 400,
      body: { error: EMAIL_MESSAGES.resetMissing },
    });
    answer(200, { message: "ok" });
    expect(
      await readJson(
        await handlePasswordReset(jsonRequest({ token: "tok", newPassword: "password123" }), API),
      ),
    ).toEqual({ status: 200, body: { message: EMAIL_MESSAGES.resetSuccess } });
    answer(400, { error: "this link is expired or invalid" });
    expect(
      await readJson(
        await handlePasswordReset(jsonRequest({ token: "tok", newPassword: "password123" }), API),
      ),
    ).toEqual({ status: 400, body: { error: EMAIL_MESSAGES.resetFailed } });
  });

  test("handlers accept an empty body when JSON is missing", async () => {
    const empty = new Request("http://app.test/api/auth", { method: "POST" });
    expect(await readJson(await handleEmailSignup(empty, API))).toEqual({
      status: 400,
      body: { error: EMAIL_MESSAGES.nameRequired },
    });
  });
});
