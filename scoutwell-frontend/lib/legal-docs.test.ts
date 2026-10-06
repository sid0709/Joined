import { describe, expect, test } from "bun:test";
import { loadLegalSections } from "./legal-docs";

describe("scout legal drafts", () => {
  test("contractor terms stay piece-rate and skip tax advice", () => {
    const sections = loadLegalSections("scout-contractor");
    const body = sections.map((section) => `${section.title} ${section.body}`).join(" ");
    expect(body).toContain("independent-contractor");
    expect(body).toContain("piece-rate");
    expect(body).toContain("not tax advice");
  });
});
