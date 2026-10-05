import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { ScoutApiClient } from "./client";
import type { ScoutProfile } from "./types";

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
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("getMe returns profile when authenticated", async () => {
    global.fetch = mock(async () =>
      Response.json(mockProfile, { status: 200 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    const profile = await client.getMe();

    expect(profile).toEqual(mockProfile);
  });

  test("getMe returns null when not authenticated (401)", async () => {
    global.fetch = mock(
      async () => new Response(null, { status: 401 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    const profile = await client.getMe();

    expect(profile).toBeNull();
  });

  test("getMe throws error on server error", async () => {
    global.fetch = mock(async () =>
      Response.json({ error: "Internal server error" }, { status: 500 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.getMe()).rejects.toThrow("Internal server error");
  });

  test("getMe throws error on network failure", async () => {
    global.fetch = mock(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.getMe()).rejects.toThrow("Cannot connect to Scout API");
  });

  test("getMe sends credentials and correct headers", async () => {
    const fetchMock = mock(async () => Response.json(mockProfile, { status: 200 }));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await client.getMe();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8082/v1/scout/me",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
      }),
    );
  });
});
