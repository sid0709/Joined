import { afterEach, describe, expect, mock, test } from "bun:test";

import { finishGoogleSignIn, seeOther, signInErrorPath, startGoogleSignIn } from "./flow";
import { googleErrorMessage } from "./messages";
import { encodeGoogleState } from "./state";

const API = "http://api.test";
const realFetch = globalThis.fetch;

function answer(status: number, body: unknown) {
  const fetchMock = mock((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(Response.json(body, { status })),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("startGoogleSignIn", () => {
  test("returns where to send the browser", async () => {
    const fetchMock = answer(200, { url: "https://accounts.google.com/x", state: "s1" });
    expect(await startGoogleSignIn(API)).toEqual({
      ok: true,
      url: "https://accounts.google.com/x",
      state: "s1",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL(`${API}/v1/auth/google/start`));
  });

  test("reports an API without Google set up, or one that is down", async () => {
    answer(503, { error: "Google sign-in is not set up" });
    expect(await startGoogleSignIn(API)).toEqual({ ok: false, error: "unavailable" });
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("ECONNREFUSED")),
    ) as unknown as typeof fetch;
    expect(await startGoogleSignIn(API)).toEqual({ ok: false, error: "failed" });
  });
});

describe("finishGoogleSignIn", () => {
  const cookie = encodeGoogleState({ state: "s1", next: "/jobs" });
  const callback = (query: string) => new URL(`http://app.test/api/auth/google/callback?${query}`);

  test("trades the code for a session token", async () => {
    const fetchMock = answer(200, { token: "t1", session: {} });
    expect(await finishGoogleSignIn(API, callback("code=c1&state=s1"), cookie)).toEqual({
      ok: true,
      token: "t1",
      next: "/jobs",
    });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(init?.body as string)).toEqual({ code: "c1", state: "s1" });
  });

  test("sends the API's own credentials along", async () => {
    const fetchMock = answer(200, { token: "t1" });
    await finishGoogleSignIn(API, callback("code=c1&state=s1"), cookie, {
      Authorization: "Bearer admin",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: "Bearer admin",
      "Content-Type": "application/json",
    });
    const started = answer(200, { url: "https://accounts.google.com/x", state: "s1" });
    await startGoogleSignIn(API, { headers: { Authorization: "Bearer admin" }, mode: "employee" });
    const init = started.mock.calls[0]?.[1];
    expect(init?.headers).toEqual({
      Authorization: "Bearer admin",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init?.body as string)).toEqual({ mode: "employee" });
  });

  test("refuses a redirect this browser did not start", async () => {
    const fetchMock = answer(200, { token: "t1" });
    expect(await finishGoogleSignIn(API, callback("code=c1&state=other"), cookie)).toMatchObject({
      ok: false,
      error: "expired",
    });
    expect(await finishGoogleSignIn(API, callback("code=c1&state=s1"), undefined)).toMatchObject({
      ok: false,
      error: "expired",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("maps Google and API failures to what the person sees", async () => {
    expect(await finishGoogleSignIn(API, callback("error=access_denied"), cookie)).toEqual({
      ok: false,
      error: "cancelled",
      next: "/jobs",
    });
    expect(await finishGoogleSignIn(API, callback("error=server_error"), cookie)).toMatchObject({
      error: "failed",
    });
    const cases: [number, string][] = [
      [400, "expired"],
      [403, "wrong_account"],
      [409, "wrong_account"],
      [503, "unavailable"],
      [502, "failed"],
    ];
    for (const [status, error] of cases) {
      answer(status, { error: "x" });
      expect(await finishGoogleSignIn(API, callback("code=c1&state=s1"), cookie)).toMatchObject({
        ok: false,
        error,
      });
    }
    answer(200, { session: {} });
    expect(await finishGoogleSignIn(API, callback("code=c1&state=s1"), cookie)).toMatchObject({
      error: "failed",
    });
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("ECONNREFUSED")),
    ) as unknown as typeof fetch;
    expect(await finishGoogleSignIn(API, callback("code=c1&state=s1"), cookie)).toMatchObject({
      error: "failed",
    });
  });
});

describe("redirects and messages", () => {
  test("send the person back to sign in with a reason", () => {
    expect(signInErrorPath("/sign-in", "cancelled", "/jobs?q=go")).toBe(
      "/sign-in?google=cancelled&next=%2Fjobs%3Fq%3Dgo",
    );
    expect(signInErrorPath("/sign-in", "failed", "")).toBe("/sign-in?google=failed");
    const response = seeOther("/jobs");
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/jobs");
  });

  test("only known reasons show a message", () => {
    expect(googleErrorMessage("cancelled")).toContain("cancelled");
    expect(googleErrorMessage("<script>")).toBe("");
    expect(googleErrorMessage(undefined)).toBe("");
  });
});
