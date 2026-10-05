import { afterEach, describe, expect, test } from "bun:test";
import { isCompanyModeEnabled, joinedApiUrl } from "./config";

const KEYS = ["JOINED_API_URL", "NEXT_PUBLIC_COMPANY_MODE_ENABLED"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("config", () => {
  test("joinedApiUrl is required and loses its trailing slash", () => {
    delete process.env.JOINED_API_URL;
    expect(() => joinedApiUrl()).toThrow("JOINED_API_URL is not set");
    process.env.JOINED_API_URL = "http://api.test/";
    expect(joinedApiUrl()).toBe("http://api.test");
    process.env.JOINED_API_URL = "http://api.test";
    expect(joinedApiUrl()).toBe("http://api.test");
  });

  test("isCompanyModeEnabled reads NEXT_PUBLIC_COMPANY_MODE_ENABLED", () => {
    process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "true";
    expect(isCompanyModeEnabled()).toBe(true);
    process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED = "false";
    expect(isCompanyModeEnabled()).toBe(false);
    delete process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED;
    expect(isCompanyModeEnabled()).toBe(false);
  });
});
