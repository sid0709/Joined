import { describe, expect, test } from "bun:test";
import { getApiHost, getWebOrigin, getSignInUrl, getSessionCookieName } from "./config";

describe("config", () => {
  test("getApiHost returns default when no env var set", () => {
    expect(getApiHost()).toBe("http://127.0.0.1:8082");
  });

  test("getWebOrigin returns default scoutwell frontend origin", () => {
    expect(getWebOrigin()).toBe("http://localhost:6003");
  });

  test("getSignInUrl uses web origin with correct path", () => {
    const url = getSignInUrl();
    expect(url).toBe("http://localhost:6003/sign-in");
  });

  test("getSessionCookieName returns scoutwell session cookie name", () => {
    expect(getSessionCookieName()).toBe("scoutwell_session");
  });
});
