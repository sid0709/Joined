import { describe, expect, test } from "bun:test";

import { ApiError, parseProblem, problemMessage } from "./problem";
import {
  IDENTITY_INCOMPLETE,
  IDENTITY_NAME_MISMATCH,
  IDENTITY_REJECTED,
  IDENTITY_UNVERIFIED,
  SCREENING_BLOCKED,
  TAX_FORM_REQUIRED,
} from "./types";

describe("problemMessage", () => {
  test("lists field errors in plain words", () => {
    expect(
      problemMessage({ errors: [{ field: "company_name", detail: "required" }], detail: "x" }),
    ).toBe("company name: required");
  });
  test("falls back from detail to error to title", () => {
    expect(problemMessage({ detail: "Too many" })).toBe("Too many");
    expect(problemMessage({ error: "legacy" })).toBe("legacy");
    expect(problemMessage({ title: "Conflict" })).toBe("Conflict");
    expect(problemMessage(null)).toBe("Something went wrong. Try again.");
  });
});

describe("parseProblem", () => {
  test("reads JSON objects only", () => {
    expect(parseProblem('{"code":"conflict"}')).toEqual({ code: "conflict" });
    expect(parseProblem("")).toBeNull();
    expect(parseProblem("<html>")).toBeNull();
    expect(parseProblem("42")).toBeNull();
  });
});

describe("ApiError", () => {
  test("keeps the code, fields, and existing id", () => {
    const error = new ApiError(409, {
      code: "conflict",
      detail: "external_ref is already used",
      existing_id: "abc",
      errors: [{ field: "url", detail: "bad" }],
    });
    expect(error.status).toBe(409);
    expect(error.code).toBe("conflict");
    expect(error.existingId).toBe("abc");
    expect(error.field("url")).toBe("bad");
    expect(error.field("title")).toBeUndefined();
  });
  test("tolerates an empty body", () => {
    const error = new ApiError(500, null);
    expect(error.code).toBe("");
    expect(error.fields).toEqual([]);
  });
});

test("first-payout identity problem codes are stable", () => {
  expect(IDENTITY_UNVERIFIED).toBe("identity_unverified");
  expect(IDENTITY_REJECTED).toBe("identity_rejected");
  expect(IDENTITY_INCOMPLETE).toBe("identity_incomplete");
  expect(IDENTITY_NAME_MISMATCH).toBe("identity_name_mismatch");
  expect(TAX_FORM_REQUIRED).toBe("tax_form_required");
  expect(SCREENING_BLOCKED).toBe("screening_blocked");
});
