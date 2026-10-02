import { describe, expect, test } from "bun:test";

import {
  GOOGLE_SIGNIN_ROUTE,
  decodeGoogleState,
  encodeGoogleState,
  googleStateCookie,
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
  });
});
