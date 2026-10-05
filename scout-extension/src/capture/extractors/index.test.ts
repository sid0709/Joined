import { describe, expect, test } from "bun:test";

import { parseHtmlDocument } from "../html-document";
import { extractForBoard } from "./index";

describe("extractForBoard", () => {
  test("returns no fields for unknown boards and delegates known boards", () => {
    const root = parseHtmlDocument("<h1>Role</h1>");
    const url = new URL("https://careers.acme.test/role");
    expect(extractForBoard("unknown", root, url)).toEqual({});
    expect(
      extractForBoard("linkedin", root, new URL("https://www.linkedin.com/jobs/view/1")).title,
    ).toBe("Role");
  });
});
