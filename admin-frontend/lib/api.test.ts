import { ApiError } from "@joined/scout";
import { afterEach, describe, expect, mock, test } from "bun:test";

import { adminDownload, adminFetch, adminSend } from "./api";

import { API_PROXY } from "@/lib/config";

const realFetch = globalThis.fetch;
const realDocument = globalThis.document;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function answer(status: number, body: unknown) {
  const fetchMock = mock(() => Promise.resolve(jsonResponse(status, body)));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function answerRaw(status: number, body: string) {
  const fetchMock = mock(() => Promise.resolve(new Response(body, { status })));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

type DownloadLink = { href: string; download: string; click: () => void };

function stubDownloadDocument() {
  const links: DownloadLink[] = [];
  globalThis.document = {
    createElement: () => {
      const link: DownloadLink = {
        href: "",
        download: "",
        click() {
          links.push({ href: link.href, download: link.download, click: link.click });
        },
      };
      return link;
    },
  } as unknown as Document;
  return links;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.document = realDocument;
});

describe("adminFetch", () => {
  test("reads JSON through the admin proxy and keeps the response fresh", async () => {
    const fetchMock = answer(200, { id: "job-1" });
    expect(await adminFetch<{ id: string }>("/v1/admin/jobs/job-1")).toEqual({ id: "job-1" });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`${API_PROXY}/v1/admin/jobs/job-1`);
    expect(init.cache).toBe("no-store");
    expect(init.headers).toEqual({ Accept: "application/json" });
  });

  test("forwards the caller's method and headers", async () => {
    const fetchMock = answer(200, { ok: true });
    await adminFetch<{ ok: boolean }>("/v1/admin/companies/c1/logo", {
      method: "POST",
      headers: { "X-Request-Id": "req-1" },
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      Accept: "application/json",
      "X-Request-Id": "req-1",
    });
  });

  test("treats 204 and an empty body as no content", async () => {
    const fetchMock = mock(() => {
      const response = new Response(null, { status: 204 });
      response.text = () => Promise.reject(new Error("204 should not be read"));
      return Promise.resolve(response);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(await adminFetch<undefined>("/v1/admin/jobs/job-1")).toBeUndefined();

    answerRaw(200, "");
    expect(await adminFetch<undefined>("/v1/admin/jobs/job-1")).toBeUndefined();
  });

  test("throws the problem from a failed response, including a non-JSON body", async () => {
    answer(409, { detail: "already running", code: "migration_busy" });
    try {
      await adminFetch("/v1/migration/jobs-copy");
      throw new Error("expected ApiError");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(409);
      expect((error as ApiError).code).toBe("migration_busy");
      expect((error as ApiError).message).toBe("already running");
    }

    answerRaw(500, "not json");
    try {
      await adminFetch("/v1/admin/jobs");
      throw new Error("expected ApiError");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(500);
      expect((error as ApiError).message).toBe("Something went wrong. Try again.");
    }
  });
});

describe("adminSend", () => {
  test("posts JSON and forwards extra headers", async () => {
    const fetchMock = answer(200, { saved: true });
    expect(
      await adminSend<{ saved: boolean }>(
        "/v1/admin/cases",
        "POST",
        { reason: "spam" },
        { "Idempotency-Key": "key-1" },
      ),
    ).toEqual({ saved: true });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`${API_PROXY}/v1/admin/cases`);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": "key-1",
    });
    expect(init.body).toBe(JSON.stringify({ reason: "spam" }));
  });

  test("omits the JSON header and body when there is nothing to send", async () => {
    const fetchMock = answer(200, { cancelled: true });
    await adminSend<{ cancelled: boolean }>("/v1/migration/jobs-copy/cancel", "POST");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(init.body).toBeUndefined();
  });
});

describe("adminDownload", () => {
  test("saves the response under the given filename", async () => {
    const fetchMock = answer(200, { companies: [] });
    const links = stubDownloadDocument();
    await adminDownload("/v1/admin/companies/export", "companies.json");
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`${API_PROXY}/v1/admin/companies/export`);
    expect(init.cache).toBe("no-store");
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(links).toHaveLength(1);
    expect(links[0]?.download).toBe("companies.json");
    expect(links[0]?.href.startsWith("blob:")).toBe(true);
  });

  test("throws the problem and does not start a download when the export fails", async () => {
    answer(403, { detail: "staff only", code: "forbidden" });
    stubDownloadDocument();
    try {
      await adminDownload("/v1/admin/companies/export", "companies.json");
      throw new Error("expected ApiError");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(403);
      expect((error as ApiError).message).toBe("staff only");
    }
  });
});
