import { afterEach, describe, expect, mock, test } from "bun:test";

import { DEFAULT_FILTERS, type JobFilters } from "@/lib/jobs/search";
import { CompanyRequestError } from "@/lib/me/client";

import {
  HIDDEN_JOB_SOURCE,
  MAX_SAVED_SEARCH_NAME_LENGTH,
  MAX_SAVED_SEARCH_QUERY_LENGTH,
  MAX_SAVED_SEARCHES,
  applySavedSearch,
  createSavedSearch,
  filtersToSavedSearch,
  isSavedSearchLimitError,
  listSavedSearches,
  sameSavedQuery,
  savedSearchCadence,
  suggestSavedSearchName,
  updateSavedSearch,
} from "@/lib/saved-searches";

const realFetch = globalThis.fetch;

function filters(patch: Partial<JobFilters> = {}): JobFilters {
  return { ...DEFAULT_FILTERS, ...patch };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("saved search filter mapping", () => {
  test("maps browse filters onto the step-34 body", () => {
    const stored = filtersToSavedSearch(
      filters({
        q: "  golang  ",
        where: "Austin",
        workplace: ["remote", "hybrid"],
        employment: ["full-time", "contract"],
        seniority: ["Senior"],
        source: ["scouted", "direct"],
        minPay: 120_000,
        posted: "7d",
        visa: true,
        sort: "newest",
      }),
    );
    expect(stored.query).toBe("golang");
    expect(stored.filters).toEqual({
      location: "Austin",
      workplace: "remote",
      employment: "full-time",
      seniority: "Senior",
      salaryMin: 120_000,
      currency: "USD",
      postedDays: 7,
      remote: true,
      sort: "newest",
      source: HIDDEN_JOB_SOURCE,
    });
    expect(stored.filters).not.toHaveProperty("visa");
  });

  test("round-trips hidden source and keeps the local visa toggle", () => {
    const current = filters({ visa: true, list: "saved", q: "ignore me" });
    const saved = filtersToSavedSearch(
      filters({
        q: "design systems",
        where: "Remote",
        workplace: ["remote"],
        source: ["scouted"],
        posted: "24h",
        sort: "pay",
      }),
    );
    const next = applySavedSearch(current, { query: saved.query, filters: saved.filters });
    expect(next.q).toBe("design systems");
    expect(next.where).toBe("Remote");
    expect(next.workplace).toEqual(["remote"]);
    expect(next.source).toEqual(["scouted"]);
    expect(next.posted).toBe("24h");
    expect(next.sort).toBe("pay");
    expect(next.visa).toBe(true);
    expect(next.list).toBe("saved");
  });

  test("does not send instant and rejects it as a cadence", () => {
    expect(savedSearchCadence("instant")).toBeNull();
    expect(savedSearchCadence("daily")).toBe("daily");
    expect(savedSearchCadence("weekly")).toBe("weekly");
    expect(savedSearchCadence("off")).toBe("off");
    expect(MAX_SAVED_SEARCHES).toBe(20);
  });

  test("clamps names and queries to the API limits", () => {
    const long = "x".repeat(MAX_SAVED_SEARCH_QUERY_LENGTH + 25);
    expect(filtersToSavedSearch(filters({ q: long })).query).toHaveLength(
      MAX_SAVED_SEARCH_QUERY_LENGTH,
    );
    expect(
      suggestSavedSearchName(filters({ q: "a".repeat(MAX_SAVED_SEARCH_NAME_LENGTH + 5) })),
    ).toHaveLength(MAX_SAVED_SEARCH_NAME_LENGTH);
    expect(suggestSavedSearchName(filters())).toBe("Saved search");
  });

  test("matches a saved search even when filter keys arrive in API order", () => {
    const current = filters({ q: "golang", where: "Austin", source: ["scouted"], posted: "3d" });
    const stored = filtersToSavedSearch(current);
    expect(
      sameSavedQuery(
        {
          query: stored.query,
          filters: {
            source: stored.filters.source,
            postedDays: stored.filters.postedDays,
            location: stored.filters.location,
          },
        },
        current,
      ),
    ).toBe(true);
  });

  test("recognizes the cap error without echoing another account", () => {
    expect(
      isSavedSearchLimitError(new CompanyRequestError("saved search limit reached", 409)),
    ).toBe(true);
    expect(isSavedSearchLimitError(new CompanyRequestError("sign in required", 401))).toBe(false);
  });
});

describe("saved search client", () => {
  test("lists, creates, and patches through the me proxy", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      if (String(input).endsWith("/saved-searches") && (!init?.method || init.method === "GET")) {
        return Promise.resolve(jsonResponse(200, { searches: [] }));
      }
      if (init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(201, {
            id: "s1",
            userId: "me",
            name: "golang",
            query: "golang",
            filters: { source: HIDDEN_JOB_SOURCE },
            alertFrequency: "daily",
            createdAt: "2026-10-05T00:00:00Z",
            updatedAt: "2026-10-05T00:00:00Z",
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(200, {
          id: "s1",
          userId: "me",
          name: "golang",
          query: "golang",
          filters: {},
          alertFrequency: "weekly",
          createdAt: "2026-10-05T00:00:00Z",
          updatedAt: "2026-10-05T00:00:00Z",
        }),
      );
    }) as unknown as typeof fetch;

    await expect(listSavedSearches()).resolves.toEqual([]);
    const created = await createSavedSearch({
      name: "golang",
      query: "golang",
      filters: { source: HIDDEN_JOB_SOURCE },
      alertFrequency: "daily",
    });
    expect(created.alertFrequency).toBe("daily");
    await updateSavedSearch("s1", { alertFrequency: "weekly" });
    expect(calls.map((call) => call.url)).toEqual([
      "/api/me/saved-searches",
      "/api/me/saved-searches",
      "/api/me/saved-searches/s1",
    ]);
    const post = JSON.parse(String(calls[1]?.init?.body)) as { alertFrequency: string };
    expect(post.alertFrequency).toBe("daily");
  });

  test("refuses to post instant", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(jsonResponse(201, {})),
    ) as unknown as typeof fetch;
    await expect(
      createSavedSearch({
        name: "now",
        query: "now",
        filters: {},
        alertFrequency: "instant" as "daily",
      }),
    ).rejects.toThrow(/off, daily, or weekly/);
  });
});
