import { describe, expect, test } from "bun:test";

import { parseHtmlDocument } from "./html-document";
import {
  extractJsonLdJob,
  findJobPosting,
  jobLocationText,
  jobPostingToFields,
  parseJsonLdText,
  REMOTE_LOCATION_LABEL,
} from "./jsonld";

describe("json-ld job posting", () => {
  test("parses objects, graphs, and typed arrays", () => {
    expect(parseJsonLdText("{not json")).toBeNull();
    expect(findJobPosting(null)).toBeNull();
    expect(findJobPosting({ "@type": "Organization" })).toBeNull();
    expect(findJobPosting({ "@type": ["JobPosting"], title: "Role" })?.title).toBe("Role");
    expect(
      findJobPosting({
        "@graph": [{ "@type": "WebPage" }, { "@type": "JobPosting", title: "Graph role" }],
      })?.title,
    ).toBe("Graph role");
    expect(findJobPosting([{ "@type": "JobPosting", title: "Listed" }])?.title).toBe("Listed");
  });

  test("maps organization, location, and html description fields", () => {
    const fields = jobPostingToFields({
      title: "Role",
      hiringOrganization: "Acme",
      jobLocation: [
        {
          address: {
            addressLocality: "Austin",
            addressRegion: "TX",
            addressCountry: "US",
          },
        },
      ],
      applicationUrl: "https://careers.acme.test/apply",
      description: "<p>Ship&nbsp;it.</p>",
    });
    expect(fields.company).toBe("Acme");
    expect(fields.location).toBe("Austin, TX, US");
    expect(fields.applyUrl).toBe("https://careers.acme.test/apply");
    expect(fields.description).toBe("Ship it.");
  });

  test("uses telecommute and string locations", () => {
    expect(jobLocationText({ jobLocation: "Remote - US" })).toBe("Remote - US");
    expect(jobLocationText({ jobLocationType: "TELECOMMUTE" })).toBe(REMOTE_LOCATION_LABEL);
    expect(jobLocationText({ applicantLocationRequirements: { name: "United States" } })).toBe(
      "United States",
    );
    expect(jobPostingToFields({ hiringOrganization: { name: "Acme Labs" } }).company).toBe(
      "Acme Labs",
    );
  });

  test("reads the first job posting script from a document", () => {
    const root = parseHtmlDocument(`
      <script type="application/ld+json">{"@type":"WebSite","name":"Acme"}</script>
      <script type="application/ld+json">{"@type":"JobPosting","title":"Role","hiringOrganization":{"name":"Acme"}}</script>
    `);
    expect(extractJsonLdJob(root)?.title).toBe("Role");
    expect(extractJsonLdJob(parseHtmlDocument("<p>none</p>"))).toBeNull();
  });
});
