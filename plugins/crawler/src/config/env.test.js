import { describe, expect, test } from "bun:test";

import {
  persistJobApiUrlToStorage,
  persistSpiritApiUrlToStorage,
  JOB_API_STORAGE_KEY,
  SPIRIT_API_STORAGE_KEY,
} from "./env.js";

describe("env persist helpers", () => {
  test("no-op when chrome storage is missing", () => {
    expect(persistJobApiUrlToStorage()).toBeUndefined();
    expect(persistSpiritApiUrlToStorage()).toBeUndefined();
    expect(JOB_API_STORAGE_KEY).toBe("jobApiBaseUrl");
    expect(SPIRIT_API_STORAGE_KEY).toBe("spiritApiBaseUrl");
  });
});
