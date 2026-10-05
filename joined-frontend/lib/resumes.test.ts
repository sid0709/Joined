import { describe, expect, test } from "bun:test";
import type { Profile } from "@/lib/profile";
import {
  PROFILE_RESUME_ID,
  PROFILE_RESUME_LABEL,
  READY_SCORE,
  RESUME_EXPORT_TYPE,
  SCORE_CONTACT,
  SCORE_EDUCATION,
  SCORE_EXPERIENCE,
  SCORE_SKILLS,
  SCORE_SUMMARY,
  SESSION_FILE_TIP,
  countResumeUses,
  defaultResume,
  hasContact,
  hasSummary,
  isProfileResume,
  isResumeReady,
  newResumeFromFile,
  profileResume,
  readyResumes,
  resumeCompleteness,
  resumeExport,
  resumeExportFilename,
  resumeExportText,
  resumeSectionSummaries,
  resumeSuggestions,
} from "./resumes";

function profile(patch: Partial<Profile> = {}): Profile {
  return {
    name: "",
    email: "",
    phone: "",
    headline: "",
    location: "",
    homeAddress: { line: "", city: "", region: "", postalCode: "", country: "" },
    about: "",
    memberSince: "",
    status: { label: "Open to work", variant: "success" },
    targetRoles: [],
    locations: [],
    workplace: "hybrid",
    salaryFloor: 0,
    currency: "USD",
    authorization: "",
    noticePeriod: "",
    skills: [],
    experience: [],
    education: [],
    personal: {
      firstName: "",
      lastName: "",
      age: 0,
      gender: "",
      pronouns: "",
      orientation: "",
      citizenship: "",
    },
    links: { linkedin: "", github: "", portfolio: "" },
    disclosures: {
      hispanicLatino: "",
      race: "",
      sponsorship: "",
      disability: "",
      veteran: "",
    },
    visibility: { openToWork: true, recruiterSearch: true, hideFromEmployer: false },
    ...patch,
  };
}

const filled = profile({
  name: "Jordan Avery",
  email: "jordan@example.com",
  phone: "312-555-0100",
  headline: "Product designer",
  location: "Chicago, IL",
  about: "Designs hiring products.",
  skills: ["Figma", "Research"],
  links: {
    linkedin: "https://linkedin.com/in/jordan",
    github: "https://github.com/jordan",
    portfolio: "https://jordan.dev",
  },
  experience: [
    {
      id: "1",
      role: "Designer",
      company: "Harbor",
      period: "2020 — Present",
      summary: "Shipped a design system used by 40 people.",
      startMonth: 1,
      startYear: 2020,
      endMonth: 0,
      endYear: 0,
      current: true,
    },
  ],
  education: [
    {
      id: "2",
      school: "RISD",
      degree: "BFA",
      field: "Graphic Design",
      period: "2012 — 2016",
      summary: "Studio concentration.",
      startMonth: 9,
      startYear: 2012,
      endMonth: 5,
      endYear: 2016,
    },
  ],
});

describe("profile résumé", () => {
  test("empty profile is not ready and scores zero", () => {
    const empty = profile();
    expect(hasContact(empty)).toBe(false);
    expect(hasSummary(empty)).toBe(false);
    expect(resumeCompleteness(empty)).toBe(0);
    expect(isResumeReady(empty)).toBe(false);
    expect(isProfileResume(PROFILE_RESUME_ID)).toBe(true);
    expect(isProfileResume("other")).toBe(false);
  });

  test("contact needs a name plus email or phone", () => {
    expect(hasContact(profile({ email: "a@b.com" }))).toBe(false);
    expect(hasContact(profile({ name: "Ada", email: "ada@example.com" }))).toBe(true);
    expect(hasContact(profile({ name: "Ada", phone: "1" }))).toBe(true);
  });

  test("summary can be a headline or about", () => {
    expect(hasSummary(profile({ headline: "PM" }))).toBe(true);
    expect(hasSummary(profile({ about: "Builds products." }))).toBe(true);
  });

  test("completeness adds each filled core section", () => {
    const named = profile({ name: "Ada", email: "ada@example.com" });
    expect(resumeCompleteness(named)).toBe(SCORE_CONTACT);
    expect(
      resumeCompleteness(
        profile({
          name: "Ada",
          email: "ada@example.com",
          about: "PM",
          experience: filled.experience,
          education: filled.education,
          skills: ["Go"],
        }),
      ),
    ).toBe(SCORE_CONTACT + SCORE_SUMMARY + SCORE_EXPERIENCE + SCORE_EDUCATION + SCORE_SKILLS);
    expect(isResumeReady(filled)).toBe(true);
    expect(resumeCompleteness(filled)).toBeGreaterThanOrEqual(READY_SCORE);
  });

  test("section summaries and suggestions track gaps", () => {
    const empty = resumeSectionSummaries(profile());
    expect(empty.map((section) => section.label)).toEqual([
      "Contact",
      "Summary",
      "Experience",
      "Education",
      "Skills",
    ]);
    expect(empty[0]?.value).toContain("Add name");
    expect(resumeSuggestions(profile()).join(" ")).toContain("Add your name");
    expect(resumeSectionSummaries(filled)[2]?.value).toBe("1 role");
    expect(resumeSectionSummaries(filled)[4]?.value).toBe("2 skills");
    expect(
      resumeSuggestions(
        profile({
          name: "Ada",
          email: "ada@example.com",
          experience: [{ ...filled.experience[0]!, summary: "" }],
        }),
      ).join(" "),
    ).toContain("measurable result");
    expect(
      resumeSuggestions(profile({ name: "Ada", email: "ada@example.com" })).join(" "),
    ).toContain("phone number");
    expect(
      resumeSectionSummaries(
        profile({ experience: filled.experience.concat(filled.experience) }),
      )[2]?.value,
    ).toBe("2 roles");
    expect(
      resumeSectionSummaries(profile({ education: filled.education.concat(filled.education) }))[3]
        ?.value,
    ).toBe("2 schools");
    expect(resumeSectionSummaries(profile({ skills: ["Go"] }))[4]?.value).toBe("1 skill");
  });

  test("profileResume is the default labeled library item", () => {
    const resume = profileResume(filled, 3);
    expect(resume.id).toBe(PROFILE_RESUME_ID);
    expect(resume.label).toBe(PROFILE_RESUME_LABEL);
    expect(resume.fileType).toBe("TXT");
    expect(resume.isDefault).toBe(true);
    expect(resume.parse).toBe("parsed");
    expect(resume.usedIn).toBe(3);
    expect(resume.skills).toEqual(["Figma", "Research"]);
    expect(resume.fileName).toBe("jordan-avery-resume.txt");
    expect(resume.sizeBytes).toBeGreaterThan(0);
    expect(defaultResume([resume])?.id).toBe(PROFILE_RESUME_ID);
    expect(readyResumes([resume, { ...resume, id: "x", parse: "failed" }])).toHaveLength(1);
    expect(defaultResume([])).toBeUndefined();
    expect(defaultResume([{ ...resume, isDefault: false }])?.id).toBe(PROFILE_RESUME_ID);
    expect(resumeExportFilename(profile({ name: "Ada Lovelace!" }))).toBe(
      "ada-lovelace-resume.txt",
    );
  });
});

describe("export", () => {
  test("writes core sections as plain text", () => {
    const text = resumeExportText(filled);
    expect(text).toContain("Jordan Avery");
    expect(text).toContain("Product designer");
    expect(text).toContain("jordan@example.com");
    expect(text).toContain("SUMMARY");
    expect(text).toContain("Designer — Harbor (2020 — Present)");
    expect(text).toContain("Shipped a design system used by 40 people.");
    expect(text).toContain("RISD — BFA, Graphic Design (2012 — 2016)");
    expect(text).toContain("Figma, Research");
    expect(text.endsWith("\n")).toBe(true);
    expect(resumeExportFilename(profile())).toBe("resume.txt");
    expect(resumeExport(filled)).toEqual({
      filename: "jordan-avery-resume.txt",
      text,
      type: RESUME_EXPORT_TYPE,
    });
  });

  test("omits empty sections", () => {
    const text = resumeExportText(profile({ name: "Ada" }));
    expect(text).toBe("Ada\n");
    expect(text.includes("SUMMARY")).toBe(false);
    expect(text.includes("EXPERIENCE")).toBe(false);
  });

  test("formats roles and schools without a period", () => {
    const text = resumeExportText(
      profile({
        name: "Ada",
        experience: [
          {
            id: "1",
            role: "Engineer",
            company: "Uber",
            period: "",
            summary: "",
            startMonth: 0,
            startYear: 0,
            endMonth: 0,
            endYear: 0,
          },
        ],
        education: [
          {
            id: "2",
            school: "MIT",
            degree: "",
            field: "",
            period: "",
            summary: "",
            startMonth: 0,
            startYear: 0,
            endMonth: 0,
            endYear: 0,
          },
        ],
      }),
    );
    expect(text).toContain("Engineer — Uber");
    expect(text).toContain("MIT");
    expect(text.includes("(")).toBe(false);
  });
});

describe("library helpers", () => {
  test("newResumeFromFile keeps the file for this visit", () => {
    const file = new File(["%PDF"], "Role Resume.docx", { type: "application/octet-stream" });
    Object.defineProperty(file, "lastModified", { value: 42 });
    const resume = newResumeFromFile(file);
    expect(resume.fileType).toBe("DOCX");
    expect(resume.label).toBe("Role Resume");
    expect(resume.parse).toBe("parsed");
    expect(resume.file).toBe(file);
    expect(resume.suggestions).toEqual([SESSION_FILE_TIP]);
    expect(resume.id).toContain("42");
  });

  test("newResumeFromFile treats non-docx as PDF", () => {
    const file = new File(["x"], "cv.pdf");
    expect(newResumeFromFile(file).fileType).toBe("PDF");
  });

  test("countResumeUses matches the label sent with applications", () => {
    expect(
      countResumeUses(
        [{ resume: PROFILE_RESUME_LABEL }, { resume: "Other" }, {}],
        PROFILE_RESUME_LABEL,
      ),
    ).toBe(1);
  });
});
