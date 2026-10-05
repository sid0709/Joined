import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import {
  IDEMPOTENCY_HEADER,
  IDEMPOTENT_REPLAYED_HEADER,
  SCOUT_EXTENSION_SUBMIT_PATH,
  SIGN_IN_TO_SUBMIT_MESSAGE,
  ScoutApiClient,
  apiErrorMessage,
  readSubmissionId,
} from "./client";
import type { ExtensionSubmissionInput, ScoutProfile } from "./types";

const mockChrome = {
  cookies: {
    get: mock(() => Promise.resolve(null as chrome.cookies.Cookie | null)),
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
    mockChrome.cookies.get.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("getMe returns null when no session cookie", async () => {
    mockChrome.cookies.get.mockResolvedValue(null);

    const client = new ScoutApiClient();
    const profile = await client.getMe();

    expect(profile).toBeNull();
  });

  test("getMe uses url parameter to read cookie", async () => {
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "test-token",
    } as chrome.cookies.Cookie);

    global.fetch = mock(async () =>
      Response.json(mockProfile, { status: 200 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await client.getMe();

    expect(mockChrome.cookies.get).toHaveBeenCalledWith({
      url: "http://localhost:6003",
      name: "scoutwell_session",
    });
  });

  test("getMe returns profile when authenticated with session cookie", async () => {
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "test-token-123",
    } as chrome.cookies.Cookie);

    global.fetch = mock(async () =>
      Response.json(mockProfile, { status: 200 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    const profile = await client.getMe();

    expect(profile).toEqual(mockProfile);
  });

  test("getMe sends Bearer token from session cookie", async () => {
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "test-session-token",
    } as chrome.cookies.Cookie);

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
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "invalid-token",
    } as chrome.cookies.Cookie);

    global.fetch = mock(
      async () => new Response(null, { status: 401 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    const profile = await client.getMe();

    expect(profile).toBeNull();
  });

  test("getMe throws error on server error", async () => {
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "test-token",
    } as chrome.cookies.Cookie);

    global.fetch = mock(async () =>
      Response.json({ error: "Internal server error" }, { status: 500 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.getMe()).rejects.toThrow("Internal server error");
  });

  test("getMe handles RFC 9457 problem detail field", async () => {
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "test-token",
    } as chrome.cookies.Cookie);

    global.fetch = mock(async () =>
      Response.json({ detail: "Resource not found", title: "Not Found" }, { status: 404 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.getMe()).rejects.toThrow("Resource not found");
  });

  test("getMe handles RFC 9457 title field when detail missing", async () => {
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "test-token",
    } as chrome.cookies.Cookie);

    global.fetch = mock(async () =>
      Response.json({ title: "Bad Request" }, { status: 400 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.getMe()).rejects.toThrow("Bad Request");
  });

  test("getMe throws error on network failure", async () => {
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "test-token",
    } as chrome.cookies.Cookie);

    global.fetch = mock(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.getMe()).rejects.toThrow("Cannot connect to Scout API");
  });

  test("getMe handles malformed error response", async () => {
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "test-token",
    } as chrome.cookies.Cookie);

    const invalidJsonResponse = new Response("not json", {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
    global.fetch = mock(async () => invalidJsonResponse) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.getMe()).rejects.toThrow("Unknown error");
  });
});

const extensionInput: ExtensionSubmissionInput = {
  title: "Staff Engineer",
  company: "Acme Labs",
  location: "Remote",
  apply_url: "https://boards.greenhouse.io/acme/jobs/123",
  description: "This captured job description is long enough to pass the minimum summary length.",
  board: "greenhouse",
};

describe("ScoutApiClient.submitExtension", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockChrome.cookies.get.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("throws when there is no session cookie", async () => {
    mockChrome.cookies.get.mockResolvedValue(null);
    const client = new ScoutApiClient();
    await expect(client.submitExtension(extensionInput, "key-1")).rejects.toThrow(
      SIGN_IN_TO_SUBMIT_MESSAGE,
    );
  });

  test("posts captured fields with the draft Idempotency-Key", async () => {
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "test-session-token",
    } as chrome.cookies.Cookie);

    const fetchMock = mock(async () =>
      Response.json({ submission: { id: "sub-1" } }, { status: 201 }),
    );
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    const result = await client.submitExtension(extensionInput, "key-1");

    expect(result).toEqual({ submission: { id: "sub-1" }, replayed: false });
    expect(fetchMock).toHaveBeenCalledWith(
      `http://127.0.0.1:8082${SCOUT_EXTENSION_SUBMIT_PATH}`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-session-token",
          Accept: "application/json",
          "Content-Type": "application/json",
          [IDEMPOTENCY_HEADER]: "key-1",
        }),
        body: JSON.stringify(extensionInput),
      }),
    );
  });

  test("retry of the same draft sends the same Idempotency-Key", async () => {
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "test-session-token",
    } as chrome.cookies.Cookie);

    const keys: string[] = [];
    global.fetch = mock(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      keys.push(headers[IDEMPOTENCY_HEADER]);
      return Response.json({ submission: { id: "sub-1" } }, { status: 201 });
    }) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await client.submitExtension(extensionInput, "key-stable");
    await client.submitExtension(extensionInput, "key-stable");

    expect(keys).toEqual(["key-stable", "key-stable"]);
  });

  test("marks a replayed idempotent response", async () => {
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "test-session-token",
    } as chrome.cookies.Cookie);

    global.fetch = mock(
      async () =>
        new Response(JSON.stringify({ submission: { id: "sub-1" } }), {
          status: 201,
          headers: {
            "Content-Type": "application/json",
            [IDEMPOTENT_REPLAYED_HEADER]: "true",
          },
        }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    const result = await client.submitExtension(extensionInput, "key-1");
    expect(result.replayed).toBe(true);
  });

  test("maps field errors from a 422 problem", async () => {
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "test-session-token",
    } as chrome.cookies.Cookie);

    global.fetch = mock(async () =>
      Response.json(
        {
          title: "Unprocessable Entity",
          errors: [
            { field: "title", detail: "required" },
            { field: "description", detail: "must be at least 40 characters" },
          ],
        },
        { status: 422 },
      ),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.submitExtension(extensionInput, "key-1")).rejects.toThrow(
      "title: required; description: must be at least 40 characters",
    );
  });

  test("throws sign-in copy on 401", async () => {
    mockChrome.cookies.get.mockResolvedValue({
      name: "scoutwell_session",
      value: "expired",
    } as chrome.cookies.Cookie);

    global.fetch = mock(
      async () => new Response(null, { status: 401 }),
    ) as unknown as typeof global.fetch;

    const client = new ScoutApiClient();
    await expect(client.submitExtension(extensionInput, "key-1")).rejects.toThrow(
      SIGN_IN_TO_SUBMIT_MESSAGE,
    );
  });
});

describe("extension submit helpers", () => {
  test("readSubmissionId requires a non-empty submission id", () => {
    expect(readSubmissionId({ submission: { id: "sub-1" } })).toBe("sub-1");
    expect(readSubmissionId({ submission: {} })).toBeNull();
    expect(readSubmissionId(null)).toBeNull();
  });

  test("apiErrorMessage prefers field errors then problem detail", () => {
    expect(
      apiErrorMessage({
        error: "x",
        detail: "nope",
        errors: [{ field: "url", detail: "required" }],
      }),
    ).toBe("url: required");
    expect(apiErrorMessage({ error: "fallback", detail: "quota exceeded" })).toBe("quota exceeded");
  });
});
