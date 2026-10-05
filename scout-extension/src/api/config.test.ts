import { describe, expect, test } from "bun:test";
import { getApiHost, getSignInUrl } from "./config";

describe("config", () => {
  test("getApiHost returns default when no env var set", () => {
    expect(getApiHost()).toBe("http://127.0.0.1:8082");
  });

  test("getSignInUrl returns local URL for localhost API", () => {
    expect(getSignInUrl()).toBe("http://localhost:3002/scout/signin");
  });

  test("getSignInUrl returns scout signin path", () => {
    const url = getSignInUrl();
    expect(url).toContain("/scout/signin");
    expect(url).toMatch(/^https?:\/\//);
  });
});
