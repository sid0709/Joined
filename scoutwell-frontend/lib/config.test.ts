import { afterEach, describe, expect, test } from "bun:test";

import { openedApiUrl, openedWebUrl, publicApiUrl } from "./config";

const KEYS = ["OPENED_API_URL", "SCOUT_PUBLIC_API_URL", "OPENED_WEB_URL"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("config", () => {
  test("the API URL is required and loses its trailing slash", () => {
    delete process.env.OPENED_API_URL;
    expect(() => openedApiUrl()).toThrow("OPENED_API_URL is not set");
    process.env.OPENED_API_URL = "http://api.test/";
    expect(openedApiUrl()).toBe("http://api.test");
  });

  test("the public API URL falls back to the API URL", () => {
    process.env.OPENED_API_URL = "http://api.test";
    delete process.env.SCOUT_PUBLIC_API_URL;
    expect(publicApiUrl()).toBe("http://api.test");
    process.env.SCOUT_PUBLIC_API_URL = "https://api.example.com/";
    expect(publicApiUrl()).toBe("https://api.example.com");
  });

  test("the Opened site URL is optional", () => {
    delete process.env.OPENED_WEB_URL;
    expect(openedWebUrl()).toBe("");
    process.env.OPENED_WEB_URL = "https://opened.test/";
    expect(openedWebUrl()).toBe("https://opened.test");
  });
});
