import { describe, expect, test } from "bun:test";
import {
  LEGAL_DOCUMENTS,
  LEGAL_DOC_TITLE,
  loadLegalSections,
  parseLegalMarkdown,
} from "./legal-docs";

describe("legal drafts", () => {
  test("rejects a file that is not marked as a draft", () => {
    expect(() => parseLegalMarkdown("## Using Joined\n\nBody.")).toThrow(LEGAL_DOC_TITLE);
    expect(() => parseLegalMarkdown("# Something else\n\n## Using Joined\n\nBody.")).toThrow(
      LEGAL_DOC_TITLE,
    );
  });

  test("each docs/legal page is a draft with sections", () => {
    for (const name of LEGAL_DOCUMENTS) {
      const sections = loadLegalSections(name);
      expect(sections.length).toBeGreaterThan(0);
      for (const section of sections) {
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.body.length).toBeGreaterThan(0);
      }
    }
  });

  test("premium terms stay in test mode and cookies match the consent categories", () => {
    const premium = loadLegalSections("premium-terms")
      .map((section) => section.body)
      .join(" ");
    expect(premium).toContain("STRIPE_ALLOW_LIVE");
    expect(premium).toContain("test mode");
    const cookies = loadLegalSections("cookies").map((section) => section.title);
    expect(cookies).toContain("Necessary");
    expect(cookies).toContain("Analytics");
  });
});
