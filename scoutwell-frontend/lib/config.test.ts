import { afterEach, describe, expect, test } from "bun:test";

import { joinedApiUrl, joinedWebUrl, publicApiUrl } from "./config";

const KEYS = ["JOINED_API_URL", "SCOUT_PUBLIC_API_URL", "JOINED_WEB_URL"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("config", () => {
  test("the API URL is required and loses its trailing slash", () => {
    delete process.env.JOINED_API_URL;
    expect(() => joinedApiUrl()).toThrow("JOINED_API_URL is not set");
    process.env.JOINED_API_URL = "http://api.test/";
    expect(joinedApiUrl()).toBe("http://api.test");
  });

  test("the public API URL falls back to the API URL", () => {
    process.env.JOINED_API_URL = "http://api.test";
    delete process.env.SCOUT_PUBLIC_API_URL;
    expect(publicApiUrl()).toBe("http://api.test");
    process.env.SCOUT_PUBLIC_API_URL = "https://api.example.com/";
    expect(publicApiUrl()).toBe("https://api.example.com");
  });

  test("the Joined site URL is optional", () => {
    delete process.env.JOINED_WEB_URL;
    expect(joinedWebUrl()).toBe("");
    process.env.JOINED_WEB_URL = "https://joined.test/";
    expect(joinedWebUrl()).toBe("https://joined.test");
  });
});
