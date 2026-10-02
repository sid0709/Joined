import { describe, expect, test } from "bun:test";

import {
  GOOGLE_AUTH_ROUTE,
  GOOGLE_CALLBACK_ROUTE,
  GOOGLE_SIGNIN_ROUTE,
  googleCallbackRoute,
  decodeGoogleState,
  encodeGoogleState,
  googleStateCookie,
  sameSiteNextPath,
} from "./state";

describe("google state cookie", () => {
  test("round-trips the state and the path the person was headed to", () => {
    const saved = { state: "abc_-123", next: "/jobs?q=go&remote=1" };
    expect(decodeGoogleState(encodeGoogleState(saved))).toEqual(saved);
    expect(decodeGoogleState(encodeGoogleState({ state: "s", next: "" }))).toEqual({
      state: "s",
      next: "",
    });
  });

  test("rejects missing or malformed values", () => {
    expect(decodeGoogleState(undefined)).toBeNull();
    expect(decodeGoogleState("")).toBeNull();
    expect(decodeGoogleState("no-dot")).toBeNull();
    expect(decodeGoogleState(".next")).toBeNull();
    expect(decodeGoogleState("s.%E0%A4%A")).toBeNull();
  });

  test("is scoped to the Google routes and survives the redirect back", () => {
    expect(googleStateCookie(true)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: GOOGLE_SIGNIN_ROUTE,
    });
    expect(googleStateCookie(false, GOOGLE_AUTH_ROUTE)).toMatchObject({
      secure: false,
      path: GOOGLE_AUTH_ROUTE,
    });
  });

  test("the callback lives under the app's route", () => {
    expect(GOOGLE_CALLBACK_ROUTE).toBe("/api/auth/google/callback");
    expect(googleCallbackRoute(GOOGLE_AUTH_ROUTE)).toBe("/auth/google/callback");
  });
});

describe("next path after sign-in", () => {
  test("keeps same-site paths and refuses other hosts", () => {
    expect(sameSiteNextPath("/trust/cases?q=1", "/")).toBe("/trust/cases?q=1");
    for (const unsafe of [
      undefined,
      null,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
    ]) {
      expect(sameSiteNextPath(unsafe, "/home")).toBe("/home");
    }
  });
});
