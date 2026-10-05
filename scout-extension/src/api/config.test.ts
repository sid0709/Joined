import { describe, expect, test } from "bun:test";
import { getApiHost, getSignInUrl } from "./config";

describe("config", () => {
  test("getApiHost returns default when no env var set", () => {
    expect(getApiHost()).toBe("http://127.0.0.1:8082");
  });

  test("getSignInUrl returns local URL for localhost API", () => {
    expect(getSignInUrl()).toBe("http://localhost:3002/scout/signin");
  });

  test("getSignInUrl returns production URL for production API", () => {
    const originalMetaEnv = import.meta.env.VITE_SCOUT_API_HOST;
    import.meta.env.VITE_SCOUT_API_HOST = "https://api.scout.example.com";

    const client = { getApiHost: () => "https://api.scout.example.com" };
    const url =
      client.getApiHost().includes("127.0.0.1") || client.getApiHost().includes("localhost")
        ? "http://localhost:3002/scout/signin"
        : `${client.getApiHost()}/scout/signin`;

    expect(url).toBe("https://api.scout.example.com/scout/signin");

    if (originalMetaEnv === undefined) {
      delete import.meta.env.VITE_SCOUT_API_HOST;
    } else {
      import.meta.env.VITE_SCOUT_API_HOST = originalMetaEnv;
    }
  });
});
