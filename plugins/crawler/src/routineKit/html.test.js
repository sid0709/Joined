import { describe, expect, test } from "bun:test";

import {
  documentFromHtml,
  htmlToPlainText,
  isFound,
  originOf,
  resolveUrl,
  textOf,
  valueAt,
} from "./html.js";
import "./testing/domParser.js";
import { workModeFrom } from "./workMode.js";

describe("html helpers", () => {
  test("parses a document and reads text", () => {
    const document = documentFromHtml("<p>  Hello   world </p>");
    expect(textOf(document.querySelector("p"))).toBe("Hello world");
    expect(htmlToPlainText("<b>Hi</b>")).toBe("Hi");
    expect(originOf("https://jobright.ai/jobs")).toBe("https://jobright.ai");
    expect(originOf("not a url")).toBe("");
    expect(resolveUrl("/jobs/info/1", "https://jobright.ai/x")).toBe(
      "https://jobright.ai/jobs/info/1",
    );
    expect(resolveUrl("", "https://jobright.ai")).toBe("");
  });

  test("valueAt and isFound cover empty and nested values", () => {
    expect(valueAt({ company: { name: "Acme" } }, "company.name")).toBe("Acme");
    expect(isFound("")).toBe(false);
    expect(isFound([])).toBe(false);
    expect(isFound({ a: "" })).toBe(false);
    expect(isFound(0)).toBe(true);
    expect(isFound(true)).toBe(true);
  });
});

describe("workModeFrom", () => {
  test("maps board labels to remote, hybrid, or onsite", () => {
    expect(workModeFrom("Remote")).toBe("remote");
    expect(workModeFrom("Hybrid")).toBe("hybrid");
    expect(workModeFrom("In-Office")).toBe("onsite");
    expect(workModeFrom("", true)).toBe("remote");
    expect(workModeFrom("On-site")).toBe("onsite");
  });
});
