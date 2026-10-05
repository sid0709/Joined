import type { AcornAccount } from "@/lib/auth/session";

export const AGE_MAX = 3;
export const SALARY_MAX = 12;
export const PATH_MAX = 180;
export const SECRET_MAX = 200;
export const LINK_MAX = 200;
export const ADDRESS_MAX = 120;
export const ROLE_SUMMARY_ROWS = 3;

export type CareerEntry = {
  id: string;
  kind: "role" | "education";
  title: string;
  org: string;
  summary: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  current: boolean;
};

/** What Acorn types into an application. */
export type ApplicantProfile = {
  fullName: string;
  firstName: string;
  lastName: string;
  age: string;
  gender: string;
  pronouns: string;
  orientation: string;
  email: string;
  phone: string;
  gmailAppPassword: string;
  street: string;
  city: string;
  state: string;
  citizenship: string;
  country: string;
  zip: string;
  linkedin: string;
  github: string;
  portfolio: string;
  hispanicLatino: string;
  raceEthnicity: string;
  visaSponsorship: string;
  disability: string;
  veteranStatus: string;
  desiredSalary: string;
  openaiApiKey: string;
  deepseekApiKey: string;
  defaultAccountPassword: string;
  resumeFolderPath: string;
  modelProvider: string;
  modelName: string;
  timeline: CareerEntry[];
};

const choice = (labels: string[]) => labels.map((label) => ({ value: label, label }));

export const GENDER_OPTIONS = choice(["Female", "Male", "Non-binary", "Decline to answer"]);
export const PRONOUN_OPTIONS = choice(["she/her", "he/him", "they/them", "Decline to answer"]);
export const ORIENTATION_OPTIONS = choice([
  "Heterosexual",
  "Gay or lesbian",
  "Bisexual",
  "Decline to answer",
]);
export const HISPANIC_OPTIONS = choice(["Yes", "No", "Decline to answer"]);
export const RACE_OPTIONS = choice([
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "White",
  "Two or more races",
  "Decline to answer",
]);
export const VISA_OPTIONS = choice([
  "No — no sponsorship",
  "Yes — will require sponsorship",
  "Decline to answer",
]);
export const DISABILITY_OPTIONS = choice([
  "No — no disability",
  "Yes — I have a disability",
  "Decline to answer",
]);
export const VETERAN_OPTIONS = choice([
  "I am not a protected veteran",
  "I am a protected veteran",
  "Decline to answer",
]);
export const CITIZENSHIP_OPTIONS = choice([
  "U.S. Citizen",
  "Permanent resident",
  "Work visa",
  "Other",
]);
export const COUNTRY_OPTIONS = choice(["United States", "Canada", "United Kingdom", "Other"]);
export const PROVIDER_OPTIONS = choice(["DeepSeek", "OpenAI"]);
export const MODEL_OPTIONS = choice([
  "deepseek-v4-flash",
  "deepseek-chat",
  "gpt-4o-mini",
  "gpt-4o",
]);

export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1);
  return { value, label: value };
});

export const YEAR_OPTIONS = Array.from({ length: 20 }, (_, index) => {
  const value = String(2026 - index);
  return { value, label: value };
});

export function sampleProfile(account: AcornAccount): ApplicantProfile {
  const parts = account.name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? account.name;
  const lastName = parts.slice(1).join(" ");
  return {
    fullName: account.name,
    firstName,
    lastName,
    age: "32",
    gender: "Decline to answer",
    pronouns: "they/them",
    orientation: "Decline to answer",
    email: account.email,
    phone: "(415) 555-0148",
    gmailAppPassword: "sample-app-password",
    street: "100 Market Street",
    city: "San Francisco",
    state: "CA",
    citizenship: "U.S. Citizen",
    country: "United States",
    zip: "94105",
    linkedin: "https://www.linkedin.com/in/sample",
    github: "https://github.com/sample",
    portfolio: "https://sample.dev",
    hispanicLatino: "No",
    raceEthnicity: "Decline to answer",
    visaSponsorship: "No — no sponsorship",
    disability: "No — no disability",
    veteranStatus: "I am not a protected veteran",
    desiredSalary: "150000",
    openaiApiKey: "sk-acorn-sample",
    deepseekApiKey: "sk-acorn-sample",
    defaultAccountPassword: "sample-account-password",
    resumeFolderPath: "~/Documents/Resumes",
    modelProvider: "DeepSeek",
    modelName: "deepseek-v4-flash",
    timeline: [
      {
        id: "role-northwind",
        kind: "role",
        title: "Senior Software Engineer",
        org: "Northwind",
        summary: "Hiring tools, application flow, and the resume the extension attaches.",
        startMonth: "1",
        startYear: "2022",
        endMonth: "",
        endYear: "",
        current: true,
      },
      {
        id: "role-lumen",
        kind: "role",
        title: "Software Engineer",
        org: "Lumen",
        summary: "Product surfaces for search, profiles, and mail.",
        startMonth: "3",
        startYear: "2018",
        endMonth: "12",
        endYear: "2021",
        current: false,
      },
      {
        id: "role-harbor",
        kind: "role",
        title: "Software Engineer",
        org: "Harbor Health",
        summary: "Patient scheduling and the internal tools around it.",
        startMonth: "6",
        startYear: "2015",
        endMonth: "2",
        endYear: "2018",
        current: false,
      },
      {
        id: "edu-state",
        kind: "education",
        title: "B.S. Computer Science",
        org: "State University",
        summary: "",
        startMonth: "9",
        startYear: "2011",
        endMonth: "5",
        endYear: "2015",
        current: false,
      },
    ],
  };
}

export function isApplicantProfile(value: unknown): value is ApplicantProfile {
  return Boolean(value && typeof value === "object" && "timeline" in value && "firstName" in value);
}

export function blankEntry(kind: CareerEntry["kind"]): CareerEntry {
  return {
    id: crypto.randomUUID(),
    kind,
    title: "",
    org: "",
    summary: "",
    startMonth: "1",
    startYear: "2024",
    endMonth: "",
    endYear: "",
    current: kind === "role",
  };
}

export function entryDates(entry: CareerEntry) {
  const start = `${entry.startYear}.${entry.startMonth}`;
  if (entry.current) return `${start} – present`;
  if (!entry.endYear) return start;
  return `${start} – ${entry.endYear}.${entry.endMonth}`;
}

export type ChecklistItem = { label: string; done: boolean };

/** What an application usually asks for, and whether the profile answers it. */
export function profileChecklist(profile: ApplicantProfile): ChecklistItem[] {
  const filled = (value: string) => value.trim().length > 0;
  return [
    {
      label: "Name and contact",
      done: filled(profile.fullName) && filled(profile.email) && filled(profile.phone),
    },
    {
      label: "Address",
      done: filled(profile.street) && filled(profile.city) && filled(profile.zip),
    },
    { label: "LinkedIn", done: filled(profile.linkedin) },
    { label: "GitHub or portfolio", done: filled(profile.github) || filled(profile.portfolio) },
    {
      label: "Work authorization",
      done: filled(profile.citizenship) && filled(profile.visaSponsorship),
    },
    { label: "Desired salary", done: filled(profile.desiredSalary) },
    {
      label: "Two or more roles",
      done: profile.timeline.filter((entry) => entry.kind === "role").length >= 2,
    },
    { label: "Education", done: profile.timeline.some((entry) => entry.kind === "education") },
    {
      label: "Role summaries",
      done: profile.timeline
        .filter((entry) => entry.kind === "role")
        .every((entry) => filled(entry.summary)),
    },
    { label: "AI model key", done: filled(profile.openaiApiKey) || filled(profile.deepseekApiKey) },
  ];
}

export function completeness(items: ChecklistItem[]) {
  return items.length
    ? Math.round((items.filter((item) => item.done).length / items.length) * 100)
    : 0;
}

export const MONTHS_PER_YEAR = 12;

/** Months between a role's start and its end, or today for a current role. */
export function monthsInRole(entry: CareerEntry, today: Date) {
  const start = Number(entry.startYear) * MONTHS_PER_YEAR + Number(entry.startMonth || 1);
  const end = entry.current
    ? today.getFullYear() * MONTHS_PER_YEAR + today.getMonth() + 1
    : Number(entry.endYear || entry.startYear) * MONTHS_PER_YEAR + Number(entry.endMonth || 1);
  return Math.max(0, end - start);
}

/** Years across every role, counting overlaps once per role. */
export function yearsOfExperience(profile: ApplicantProfile, today: Date) {
  const months = profile.timeline
    .filter((entry) => entry.kind === "role")
    .reduce((total, entry) => total + monthsInRole(entry, today), 0);
  return Math.round((months / MONTHS_PER_YEAR) * 10) / 10;
}
