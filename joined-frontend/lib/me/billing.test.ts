import { afterEach, describe, expect, mock, test } from "bun:test";
import { checkoutRequest, portalRequest } from "@/lib/billing";
import { fetchSubscription, startCheckout, startPortal } from "./billing";
import {
  CompanyRequestError,
  companyGet,
  companySend,
  companySendForm,
  isBadRequestError,
  isConflictError,
  isForbiddenError,
} from "./client";

const ORIGIN = "https://app.test";
const realFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function answer(status: number, body: unknown) {
  const fetchMock = mock((input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return Promise.resolve(jsonResponse(status, body));
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function answerRaw(status: number, body: string) {
  const fetchMock = mock(() => Promise.resolve(new Response(body, { status })));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("me billing helpers", () => {
  test("fetchSubscription GETs the current plan", async () => {
    const fetchMock = answer(200, {
      premium: true,
      status: "active",
      plan: "yearly",
      current_period_end: "2026-11-01T00:00:00Z",
    });
    await expect(fetchSubscription()).resolves.toEqual({
      premium: true,
      status: "active",
      plan: "yearly",
      current_period_end: "2026-11-01T00:00:00Z",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/me/billing/subscription");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).cache).toBe("no-store");
  });

  test("startCheckout posts the plan and return URLs", async () => {
    const fetchMock = answer(200, { url: "https://checkout.stripe.test/cs_test" });
    await expect(startCheckout("monthly", ORIGIN)).resolves.toEqual({
      url: "https://checkout.stripe.test/cs_test",
    });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/me/billing/checkout");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual(checkoutRequest("monthly", ORIGIN));
  });

  test("startPortal posts the settings return URL", async () => {
    const fetchMock = answer(200, { url: "https://billing.stripe.test/session" });
    await expect(startPortal(ORIGIN)).resolves.toEqual({
      url: "https://billing.stripe.test/session",
    });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/me/billing/portal");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(portalRequest(ORIGIN));
  });

  test("checkout and portal failures surface the API error and code", async () => {
    answer(409, { error: "checkout paused", code: "billing_checkout_disabled" });
    try {
      await startCheckout("yearly", ORIGIN);
      throw new Error("expected CompanyRequestError");
    } catch (error) {
      expect(error).toBeInstanceOf(CompanyRequestError);
      expect(isConflictError(error)).toBe(true);
      expect((error as CompanyRequestError).message).toBe("checkout paused");
      expect((error as CompanyRequestError).code).toBe("billing_checkout_disabled");
    }

    answerRaw(500, "not json");
    try {
      await startPortal(ORIGIN);
      throw new Error("expected CompanyRequestError");
    } catch (error) {
      expect(error).toBeInstanceOf(CompanyRequestError);
      expect((error as CompanyRequestError).status).toBe(500);
      expect((error as CompanyRequestError).message).toBe("Request failed");
    }
  });
});

describe("company and me request helpers", () => {
  test("empty 200 and 204 bodies resolve to undefined", async () => {
    answerRaw(200, "");
    await expect(companyGet("/profile")).resolves.toBeUndefined();
    answerRaw(204, "");
    await expect(companySend("/profile", "DELETE")).resolves.toBeUndefined();
  });

  test("companySend without a body omits JSON headers", async () => {
    const fetchMock = answer(200, { ok: true });
    await companySend("/profile", "POST");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  test("companySendForm posts FormData without rewriting content-type", async () => {
    const form = new FormData();
    form.append("logo", "file");
    const fetchMock = answer(200, { url: "/logo.png" });
    await expect(companySendForm("/logo", "POST", form)).resolves.toEqual({ url: "/logo.png" });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/company/logo");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(form);
    expect(init.headers).toBeUndefined();
  });

  test("error helpers match status and ignore unrelated failures", async () => {
    answer(403, { error: "forbidden" });
    try {
      await companyGet("/secret");
      throw new Error("expected CompanyRequestError");
    } catch (error) {
      expect(isForbiddenError(error)).toBe(true);
      expect(isConflictError(error)).toBe(false);
      expect(isBadRequestError(error)).toBe(false);
    }

    answer(400, {});
    try {
      await companySend("/profile", "PATCH", { name: "" });
      throw new Error("expected CompanyRequestError");
    } catch (error) {
      expect(isBadRequestError(error)).toBe(true);
      expect((error as CompanyRequestError).message).toBe("Request failed");
    }

    expect(isConflictError(new Error("offline"))).toBe(false);
    expect(isForbiddenError({ status: 403 })).toBe(false);
    expect(isBadRequestError(null)).toBe(false);
  });
});
