import { describe, expect, mock, test } from "bun:test";

import {
  ACCOUNT_EXPORT_FILENAME,
  ACCOUNT_EXPORT_PATH,
  ACCOUNT_EXPORT_RATE_LIMIT,
  ACCOUNT_EXPORT_ZIP_FILENAME,
  downloadAccountExport,
  exportFailure,
  exportFilename,
} from "@/lib/account-export";

const realFetch = globalThis.fetch;

describe("account export download", () => {
  test("names a json file unless the body is a zip", () => {
    expect(exportFilename("application/json")).toBe(ACCOUNT_EXPORT_FILENAME);
    expect(exportFilename(null)).toBe(ACCOUNT_EXPORT_FILENAME);
    expect(exportFilename("application/zip")).toBe(ACCOUNT_EXPORT_ZIP_FILENAME);
  });

  test("maps a rate limit to the API message", () => {
    const error = exportFailure(429, JSON.stringify({ error: "export rate limited" }));
    expect(error.status).toBe(429);
    expect(error.message).toBe("export rate limited");
  });

  test("uses the named rate-limit copy when the body is empty", () => {
    const error = exportFailure(429, "not-json");
    expect(error.message).toBe(ACCOUNT_EXPORT_RATE_LIMIT);
  });

  test("downloads the export and prefers a problem detail", async () => {
    const clicks: string[] = [];
    const previousDocument = globalThis.document;
    const previousUrl = globalThis.URL;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: () => ({
          href: "",
          download: "",
          click() {
            clicks.push(this.download);
          },
        }),
      },
    });
    class FakeURL extends URL {
      static createObjectURL() {
        return "blob:export";
      }
      static revokeObjectURL() {}
    }
    Object.defineProperty(globalThis, "URL", { configurable: true, value: FakeURL });
    globalThis.fetch = mock((input: string) => {
      expect(input).toBe(ACCOUNT_EXPORT_PATH);
      return Promise.resolve(
        new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    }) as unknown as typeof fetch;
    try {
      expect(await downloadAccountExport()).toEqual({ filename: ACCOUNT_EXPORT_FILENAME });
      expect(clicks).toEqual([ACCOUNT_EXPORT_FILENAME]);
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ detail: "Try later." }), { status: 429 })),
      ) as unknown as typeof fetch;
      expect(downloadAccountExport()).rejects.toMatchObject({
        message: "Try later.",
        status: 429,
      });
    } finally {
      globalThis.fetch = realFetch;
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
      Object.defineProperty(globalThis, "URL", { configurable: true, value: previousUrl });
    }
  });
});
