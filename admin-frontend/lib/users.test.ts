import { afterEach, expect, test } from "bun:test";

import { canSubmitUserAction, runUserAction, userDetailPath, userLookupPath } from "./users";

import { API_PROXY } from "@/lib/config";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("lookup prefers email and skips an empty query", () => {
  expect(userLookupPath("  hunter@example.com ", "u1")).toBe(
    "/v1/admin/users?email=hunter%40example.com",
  );
  expect(userLookupPath("", " u1 ")).toBe("/v1/admin/users?id=u1");
  expect(userLookupPath("  ", "")).toBe("");
});

test("detail path encodes the id", () => {
  expect(userDetailPath("user/1")).toBe("/v1/admin/users/user%2F1");
});

test("actions stay off until a reason is present", () => {
  expect(canSubmitUserAction("")).toBe(false);
  expect(canSubmitUserAction("  abuse")).toBe(true);
  expect(canSubmitUserAction("goodwill", 0)).toBe(false);
  expect(canSubmitUserAction("goodwill", 500)).toBe(true);
});

test("refund posts the trimmed reason and amount", async () => {
  const calls: { path: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ path: String(input), init: init ?? {} });
    return Response.json({ user: { id: "u1" }, auditId: "a1" });
  }) as typeof fetch;

  const result = await runUserAction("u1", "refund", "  goodwill ", 500);
  expect(result.auditId).toBe("a1");
  expect(calls[0]?.path).toBe(`${API_PROXY}/v1/admin/users/u1/premium/refund`);
  expect(calls[0]?.init.method).toBe("POST");
  expect(calls[0]?.init.body).toBe(JSON.stringify({ reason: "goodwill", amount_cents: 500 }));
});

test("suspend posts the reason without an amount", async () => {
  const calls: { path: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ path: String(input), init: init ?? {} });
    return Response.json({ user: { id: "user/1" }, auditId: "a2" });
  }) as typeof fetch;

  await runUserAction("user/1", "suspend", "abuse");
  expect(calls[0]?.path).toBe(`${API_PROXY}/v1/admin/users/user%2F1/suspend`);
  expect(calls[0]?.init.body).toBe(JSON.stringify({ reason: "abuse" }));
});
