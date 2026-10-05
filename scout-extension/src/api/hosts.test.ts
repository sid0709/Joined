import { describe, expect, test } from "bun:test";

import {
  DEV_API_HOST,
  DEV_WEB_ORIGIN,
  PRODUCTION_API_HOST,
  PRODUCTION_WEB_ORIGIN,
  containsLocalDevHost,
  hostPermissionPattern,
  isDevApiHost,
  resolveHost,
  uniqueHostPermissions,
} from "./hosts";

describe("hosts", () => {
  test("resolveHost uses the development default outside production", () => {
    expect(resolveHost(undefined, "development", PRODUCTION_API_HOST, DEV_API_HOST)).toBe(
      DEV_API_HOST,
    );
    expect(resolveHost(undefined, undefined, PRODUCTION_WEB_ORIGIN, DEV_WEB_ORIGIN)).toBe(
      DEV_WEB_ORIGIN,
    );
  });

  test("resolveHost uses the production default in production mode", () => {
    expect(resolveHost(undefined, "production", PRODUCTION_API_HOST, DEV_API_HOST)).toBe(
      PRODUCTION_API_HOST,
    );
  });

  test("resolveHost prefers an env override and strips a trailing slash", () => {
    expect(
      resolveHost("https://api.example.com/", "development", PRODUCTION_API_HOST, DEV_API_HOST),
    ).toBe("https://api.example.com");
  });

  test("uniqueHostPermissions collapses the same origin", () => {
    expect(uniqueHostPermissions([PRODUCTION_API_HOST, `${PRODUCTION_WEB_ORIGIN}/`])).toEqual([
      hostPermissionPattern(PRODUCTION_API_HOST),
    ]);
  });

  test("containsLocalDevHost detects loopback hosts", () => {
    expect(containsLocalDevHost("http://localhost:8082/*")).toBe(true);
    expect(containsLocalDevHost("http://127.0.0.1:8082/*")).toBe(true);
    expect(containsLocalDevHost("http://[::1]:8082/*")).toBe(true);
    expect(containsLocalDevHost("https://scout.joinedhq.com/*")).toBe(false);
  });

  test("isDevApiHost treats the named development hosts as disallowed in production", () => {
    expect(isDevApiHost(DEV_API_HOST)).toBe(true);
    expect(isDevApiHost(`${DEV_WEB_ORIGIN}/`)).toBe(true);
    expect(isDevApiHost(PRODUCTION_API_HOST)).toBe(false);
  });
});
