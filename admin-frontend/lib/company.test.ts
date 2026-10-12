import { afterEach, describe, expect, it, mock } from "bun:test";

import { API_PROXY } from "@/lib/config";

import {
  applyAutofill,
  autofillPath,
  type AdminCompany,
  companyLogoSrc,
  companyWriteFrom,
  companyWriteJSON,
  downloadStagedCompanies,
  importStagedCompanies,
  parseCompanyWriteJSON,
  STAGED_COMPANIES_FILE,
  STAGED_COMPANY_STATUS,
  stagedCompanyStatusLabel,
  TEMP_COMPANIES_EXPORT_PATH,
  TEMP_COMPANIES_IMPORT_PATH,
} from "./company";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

const base: AdminCompany = {
  id: "c1",
  name: "g2i",
  url: "https://www.g2i.co",
  logo: "https://logo.example/g.png",
  jobCount: 0,
  tagline: "",
  about: "",
  industry: "",
  size: "",
  founded: 0,
  replyDays: 3,
  headquarters: "",
  companyType: "",
  locations: "",
  specialties: [],
  mission: "",
  values: [],
  benefitCategories: [],
};

describe("applyAutofill", () => {
  const draft = companyWriteFrom(base);

  it("fills what the search found and keeps the website and logo as entered", () => {
    const found = {
      ...draft,
      name: "G2i",
      url: "https://elsewhere.example",
      tagline: "Engineering talent",
      industry: "Software",
      companyType: "Other",
      size: "11–50",
      founded: 2016,
      values: [{ icon: "star", title: "Ship it", description: "" }],
      logo: "https://ignored.example/logo.png",
      replyDays: 99,
    };
    const next = applyAutofill(draft, found);
    expect(next.name).toBe("G2i");
    expect(next.industry).toBe("Software");
    expect(next.companyType).toBe("Other");
    expect(next.size).toBe("11–50");
    expect(next.founded).toBe(2016);
    expect(next.values).toHaveLength(1);
    expect(next.url).toBe("https://www.g2i.co");
    expect(next.logo).toBe("https://logo.example/g.png");
    expect(next.replyDays).toBe(3);
  });

  it("keeps existing answers where the search found nothing", () => {
    const current = { ...draft, about: "Written by hand", founded: 2010, specialties: ["Hiring"] };
    const empty = { ...draft, about: "", founded: 0, specialties: [] };
    const next = applyAutofill(current, empty);
    expect(next.about).toBe("Written by hand");
    expect(next.founded).toBe(2010);
    expect(next.specialties).toEqual(["Hiring"]);
  });

  it("uses the website when the form has none", () => {
    const next = applyAutofill({ ...draft, url: "" }, { ...draft, url: "https://g2i.co" });
    expect(next.url).toBe("https://g2i.co");
  });
});

describe("autofillPath", () => {
  it("encodes the company id", () => {
    expect(autofillPath("a/b")).toBe("/v1/companies/a%2Fb/autofill");
  });
});

describe("companyLogoSrc", () => {
  const apiLogo = (id: string, version = 0) =>
    `${API_PROXY}/v1/companies/${encodeURIComponent(id)}/logo?v=${version}`;

  it("has no logo when there is neither a URL nor an uploaded file", () => {
    expect(companyLogoSrc({ id: "c1" })).toBeUndefined();
    expect(companyLogoSrc({ id: "c1", logo: "  " })).toBeUndefined();
  });

  it("uses an ordinary logo URL as is", () => {
    expect(companyLogoSrc({ id: "c1", logo: " https://logo.example/g.png " })).toBe(
      "https://logo.example/g.png",
    );
    expect(companyLogoSrc({ id: "c1", logo: "not a url" })).toBe("not a url");
  });

  it("serves LinkedIn logos through the API", () => {
    for (const logo of [
      "https://linkedin.com/logo.png",
      "https://www.linkedin.com/logo.png",
      "https://licdn.com/logo.png",
      "https://media.licdn.com/logo.png",
    ]) {
      expect(companyLogoSrc({ id: "c1", logo })).toBe(apiLogo("c1"));
    }
  });

  it("serves an uploaded file through the API, versioned for cache busting", () => {
    expect(companyLogoSrc({ id: "a/b", hasLogoFile: true }, 4)).toBe(apiLogo("a/b", 4));
  });
});

describe("stagedCompanyStatusLabel", () => {
  it("names the two staged states", () => {
    expect(stagedCompanyStatusLabel(STAGED_COMPANY_STATUS.waiting)).toBe("Waiting");
    expect(stagedCompanyStatusLabel(STAGED_COMPANY_STATUS.notFound)).toBe("Not found");
  });
});

describe("parseCompanyWriteJSON", () => {
  it("round-trips a form draft", () => {
    const draft = companyWriteFrom(base);
    const parsed = parseCompanyWriteJSON(companyWriteJSON(draft));
    expect(parsed).toEqual(draft);
  });

  it("rejects unknown fields and bad sizes", () => {
    expect(parseCompanyWriteJSON('{"id":"x","name":"Acme"}')).toEqual({
      error: 'Unknown field "id"',
    });
    expect(parseCompanyWriteJSON('{"name":"Acme","size":"huge"}')).toEqual({
      error: "size is not a listed company size",
    });
  });

  it("canonicalizes listed sizes", () => {
    const parsed = parseCompanyWriteJSON('{"name":"Acme","size":"11-50"}');
    if ("error" in parsed) {
      throw new Error(parsed.error);
    }
    expect(parsed.size).toBe("11–50");
  });

  it("rejects invalid JSON and non-objects", () => {
    expect(parseCompanyWriteJSON("{")).toEqual({ error: "JSON is not valid" });
    expect(parseCompanyWriteJSON("[]")).toEqual({ error: "Expected a JSON object" });
    expect(parseCompanyWriteJSON("null")).toEqual({ error: "Expected a JSON object" });
  });

  it("rejects wrong field types", () => {
    expect(parseCompanyWriteJSON('{"name":1}')).toEqual({ error: "name must be a string" });
    expect(parseCompanyWriteJSON('{"name":"Acme","founded":2016.5}')).toEqual({
      error: "founded must be a integer",
    });
    expect(parseCompanyWriteJSON('{"name":"Acme","specialties":"x"}')).toEqual({
      error: "specialties must be a string array",
    });
    expect(parseCompanyWriteJSON('{"name":"Acme","specialties":[1]}')).toEqual({
      error: "specialties[0] must be a string",
    });
    expect(parseCompanyWriteJSON('{"name":"Acme","values":{}}')).toEqual({
      error: "values must be a array",
    });
    expect(parseCompanyWriteJSON('{"name":"Acme","values":[1]}')).toEqual({
      error: "values[0] must be a object",
    });
    expect(parseCompanyWriteJSON('{"name":"Acme","values":[{"icon":1}]}')).toEqual({
      error: "values[0].icon must be a string",
    });
    expect(parseCompanyWriteJSON('{"name":"Acme","benefitCategories":"x"}')).toEqual({
      error: "benefitCategories must be a array",
    });
    expect(parseCompanyWriteJSON('{"name":"Acme","benefitCategories":[1]}')).toEqual({
      error: "benefitCategories[0] must be a object",
    });
    expect(
      parseCompanyWriteJSON('{"name":"Acme","benefitCategories":[{"label":"P","items":1}]}'),
    ).toEqual({ error: "benefitCategories[0].items must be a string array" });
    expect(
      parseCompanyWriteJSON('{"name":"Acme","benefitCategories":[{"label":"P","items":[1]}]}'),
    ).toEqual({ error: "benefitCategories[0].items[0] must be a string" });
  });

  it("validates required and range fields", () => {
    expect(parseCompanyWriteJSON('{"name":""}')).toEqual({ error: "name is required" });
    expect(parseCompanyWriteJSON(`{"name":"${"a".repeat(81)}"}`)).toEqual({
      error: "name is too long",
    });
    expect(parseCompanyWriteJSON('{"name":"Acme","url":"notaurl"}')).toEqual({
      error: "url is not a link",
    });
    expect(parseCompanyWriteJSON('{"name":"Acme","url":"https://bad example.com"}')).toEqual({
      error: "url is not a link",
    });
    expect(parseCompanyWriteJSON('{"name":"Acme","logo":"javascript:alert(1)"}')).toEqual({
      error: "logo is not a link",
    });
    expect(parseCompanyWriteJSON('{"name":"Acme","founded":1700}')).toEqual({
      error: "founded is out of range",
    });
    expect(parseCompanyWriteJSON('{"name":"Acme","replyDays":400}')).toEqual({
      error: "replyDays is out of range",
    });
    expect(
      parseCompanyWriteJSON(
        JSON.stringify({
          name: "Acme",
          benefitCategories: Array.from({ length: 13 }, (_, i) => ({
            label: `B${i}`,
            items: [],
          })),
        }),
      ),
    ).toEqual({ error: "benefitCategories cannot exceed 12" });
    expect(
      parseCompanyWriteJSON(
        '{"name":"Acme","values":[{"icon":"not-an-icon","title":"T","description":""}]}',
      ),
    ).toEqual({ error: 'values icon "not-an-icon" is not listed' });
  });

  it("accepts nullish nested collections and trims strings", () => {
    const parsed = parseCompanyWriteJSON(
      JSON.stringify({
        name: "  Acme  ",
        specialties: null,
        values: null,
        benefitCategories: [{ label: " Health ", items: null }],
      }),
    );
    if ("error" in parsed) {
      throw new Error(parsed.error);
    }
    expect(parsed.name).toBe("Acme");
    expect(parsed.specialties).toEqual([]);
    expect(parsed.values).toEqual([]);
    expect(parsed.benefitCategories).toEqual([{ label: "Health", items: [] }]);
  });
});

describe("staged company import and export", () => {
  const realDocument = globalThis.document;

  afterEach(() => {
    globalThis.document = realDocument;
  });

  it("downloads the staged export file", async () => {
    const fetchMock = mock((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        new Response(JSON.stringify({ companies: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const links: { href: string; download: string }[] = [];
    globalThis.document = {
      createElement: () => {
        const link = {
          href: "",
          download: "",
          click() {
            links.push({ href: link.href, download: link.download });
          },
        };
        return link;
      },
    } as unknown as Document;

    await downloadStagedCompanies();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_PROXY}${TEMP_COMPANIES_EXPORT_PATH}`);
    expect(links).toEqual([
      { href: expect.stringMatching(/^blob:/), download: STAGED_COMPANIES_FILE },
    ]);
  });

  it("posts the import body", async () => {
    const fetchMock = mock((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        new Response(JSON.stringify({ published: 2, unmatched: ["x"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const body = '{"companies":[]}';
    await expect(importStagedCompanies(body)).resolves.toEqual({
      published: 2,
      unmatched: ["x"],
    });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`${API_PROXY}${TEMP_COMPANIES_IMPORT_PATH}`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(body);
  });
});
