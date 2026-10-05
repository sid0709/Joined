import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { ScoutApiClient } from "./client";
import type { ScoutProfile } from "./types";

const mockChrome = {
  cookies: {
    getAll: mock(() => Promise.resolve([] as chrome.cookies.Cookie[])),
  },
};

(globalThis as unknown as { chrome: typeof mockChrome }).chrome = mockChrome;

describe("ScoutApiClient", () => {
  const mockProfile: ScoutProfile = {
    user_id: "test-user-123",
    name: "Test Scout",
    email: "scout@example.com",
    level: "bronze",
    level_pinned: false,
    terms_accepted_at: "2024-01-01T00:00:00Z",
    verification: "none",
    notify_decisions: true,
    notify_rewards: true,
    verification_tier: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockChrome.cookies.getAll.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("getMe returns null when no session cookie", async () => {
    mockChrome.cookies.getAll.mockResolvedValue([]);

    const client = new ScoutApiClient();
    const profile = await client.getMe();

    expect(profile).toBeNull();
  });

  test("getMe returns profile when authenticated with session cookie", async () => {
    mockChrome.cookies.getAll.mockResolvedValue([
      { name: "scoutwell_session", value: "test-token-123" } as chrome.cookies.Cookie,
    ]);

    global.fetch = mock(async () =>
      Response.json(mockProfile, { status: 200 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    const profile = await client.getMe();

    expect(profile).toEqual(mockProfile);
  });

  test("getMe sends Bearer token from session cookie", async () => {
    mockChrome.cookies.getAll.mockResolvedValue([
      { name: "scoutwell_session", value: "test-session-token" } as chrome.cookies.Cookie,
    ]);

    const fetchMock = mock(async () => Response.json(mockProfile, { status: 200 }));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await client.getMe();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8082/v1/scout/me",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-session-token",
          Accept: "application/json",
        }),
      }),
    );
  });

  test("getMe returns null when not authenticated (401)", async () => {
    mockChrome.cookies.getAll.mockResolvedValue([
      { name: "scoutwell_session", value: "invalid-token" } as chrome.cookies.Cookie,
    ]);

    global.fetch = mock(async () => new Response(null, { status: 401 })) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    const profile = await client.getMe();

    expect(profile).toBeNull();
  });

  test("getMe throws error on server error", async () => {
    mockChrome.cookies.getAll.mockResolvedValue([
      { name: "scoutwell_session", value: "test-token" } as chrome.cookies.Cookie,
    ]);

    global.fetch = mock(async () =>
      Response.json({ error: "Internal server error" }, { status: 500 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.getMe()).rejects.toThrow("Internal server error");
  });

  test("getMe handles RFC 9457 problem detail field", async () => {
    mockChrome.cookies.getAll.mockResolvedValue([
      { name: "scoutwell_session", value: "test-token" } as chrome.cookies.Cookie,
    ]);

    global.fetch = mock(async () =>
      Response.json({ detail: "Resource not found", title: "Not Found" }, { status: 404 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.getMe()).rejects.toThrow("Resource not found");
  });

  test("getMe handles RFC 9457 title field when detail missing", async () => {
    mockChrome.cookies.getAll.mockResolvedValue([
      { name: "scoutwell_session", value: "test-token" } as chrome.cookies.Cookie,
    ]);

    global.fetch = mock(async () =>
      Response.json({ title: "Bad Request" }, { status: 400 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.getMe()).rejects.toThrow("Bad Request");
  });

  test("getMe throws error on network failure", async () => {
    mockChrome.cookies.getAll.mockResolvedValue([
      { name: "scoutwell_session", value: "test-token" } as chrome.cookies.Cookie,
    ]);

    global.fetch = mock(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.getMe()).rejects.toThrow("Cannot connect to Scout API");
  });

  test("getMe handles malformed error response", async () => {
    mockChrome.cookies.getAll.mockResolvedValue([
      { name: "scoutwell_session", value: "test-token" } as chrome.cookies.Cookie,
    ]);

    const invalidJsonResponse = new Response("not json", {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
    global.fetch = mock(async () => invalidJsonResponse) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.getMe()).rejects.toThrow("Unknown error");
  });
});
