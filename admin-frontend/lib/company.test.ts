import { describe, expect, it } from "bun:test";

import { API_PROXY } from "@/lib/config";

import {
  applyAutofill,
  autofillPath,
  type AdminCompany,
  companyLogoSrc,
  companyWriteFrom,
  STAGED_COMPANY_STATUS,
  stagedCompanyStatusLabel,
} from "./company";

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
