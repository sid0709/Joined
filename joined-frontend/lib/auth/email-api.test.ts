import { afterEach, describe, expect, mock, test } from "bun:test";
import { EMAIL_API_PATHS, EMAIL_MESSAGES } from "./email";
import { extractSessionToken, postJoinedAuth, verifyEmailToken } from "./email-api";

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
