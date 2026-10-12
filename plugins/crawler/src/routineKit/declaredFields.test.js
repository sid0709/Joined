import { describe, expect, test } from "bun:test";

import {
  CORE_JOB_FIELD_KEYS,
  CORE_JOB_FIELDS,
  declareJobFields,
  declaredFieldProblems,
  field,
  FIELD_TYPES,
  isCoreJobFieldKey,
  listDeclaredFields,
  listExtractorFields,
} from "./declaredFields.js";
import { text } from "./fields.js";

describe("declared fields", () => {
  test("lists the required core once, then extras", () => {
    const fields = declareJobFields([
      field("location", "Location", FIELD_TYPES.STRING),
      field("applyUrl", "Apply URL", FIELD_TYPES.URL, true),
    ]);
    expect(fields.map((item) => item.key)).toEqual([
      "title",
      "description",
      "companyName",
      "location",
      "applyUrl",
    ]);
    expect(fields.find((item) => item.key === "applyUrl").required).toBe(true);
    expect(fields.find((item) => item.key === "location").required).toBe(false);
    expect(CORE_JOB_FIELDS).toHaveLength(4);
    expect(CORE_JOB_FIELD_KEYS.every(isCoreJobFieldKey)).toBe(true);
  });

  test("rejects a bad extra field list", () => {
    expect(() => declareJobFields("nope")).toThrow(/list of fields/);
    expect(() => declareJobFields([{ key: "", label: "", type: "nope" }])).toThrow(
      /Invalid declared fields/,
    );
    expect(() =>
      declareJobFields([
        field("location", "Location", FIELD_TYPES.STRING),
        field("location", "Place", FIELD_TYPES.STRING),
      ]),
    ).toThrow(/duplicated/);
  });

  test("checks declaredFields on a routine", () => {
    expect(declaredFieldProblems(null)).toEqual([]);
    expect(declaredFieldProblems("x")).toEqual(["declaredFields must be a list"]);
    expect(declaredFieldProblems([])).toEqual(["declaredFields must define at least one field"]);
    expect(
      declaredFieldProblems(
        [{ key: "applyUrl", label: "Apply URL", type: "url", required: false }],
        {
          requireCore: true,
        },
      ),
    ).toEqual([
      'declared field "applyUrl" must be required',
      'declaredFields must include required core field "title"',
      'declaredFields must include required core field "description"',
      'declaredFields must include required core field "companyName"',
    ]);
  });

  test("lists declared fields, falling back to CSS extractor paths", () => {
    const declared = [{ key: "title", label: "Title", type: "string", required: true }];
    expect(listDeclaredFields({ declaredFields: declared })).toEqual(declared);
    expect(listExtractorFields({ fields: { title: text("h1") } }).map(({ path }) => path)).toEqual([
      "title",
    ]);
    expect(listDeclaredFields({ fields: { title: text("h1", { label: "Job title" }) } })).toEqual([
      { key: "title", label: "Job title", type: "string", required: false },
    ]);
  });
});
