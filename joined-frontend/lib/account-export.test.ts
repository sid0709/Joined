import { describe, expect, test } from "bun:test";
import {
  ACCOUNT_EXPORT_FILENAME,
  ACCOUNT_EXPORT_RATE_LIMIT,
  ACCOUNT_EXPORT_ZIP_FILENAME,
  exportFailure,
  exportFilename,
} from "@/lib/account-export";

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
});
