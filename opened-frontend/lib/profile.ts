import type { BadgeVariant } from "@openseat/design-system";

export type Workplace = "remote" | "hybrid" | "onsite";

export type Option<T extends string = string> = { value: T; label: string };

export type ExperienceItem = {
  id: string;
  role: string;
  company: string;
  period: string;
  summary: string;
  current?: boolean;
};

export type StrengthStep = {
  id: string;
  label: string;
  done: boolean;
};

export type VisibilityKey = "openToWork" | "recruiterSearch" | "hideFromEmployer";

export type VisibilitySetting = {
  key: VisibilityKey;
  label: string;
  description: string;
};

export type Profile = {
  name: string;
  headline: string;
  location: string;
  about: string;
  memberSince: string;
  status: { label: string; variant: BadgeVariant };
  targetRoles: string[];
  locations: string[];
  workplace: Workplace;
  salaryFloor: number;
  currency: string;
  authorization: string;
  noticePeriod: string;
  skills: string[];
  visibility: Record<VisibilityKey, boolean>;
};

export const WORKPLACE_OPTIONS: Option<Workplace>[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

export const AUTHORIZATION_OPTIONS: Option[] = [
  { value: "us-citizen", label: "US citizen or permanent resident" },
  { value: "us-visa", label: "Authorized, visa sponsorship not required" },
  { value: "us-sponsor", label: "Requires visa sponsorship" },
];

export const NOTICE_OPTIONS: Option[] = [
  { value: "now", label: "Immediately" },
  { value: "2w", label: "2 weeks" },
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months or more" },
];

export const ROLE_SUGGESTIONS = [
  "Product designer",
  "Content designer",
  "UX researcher",
  "Design systems lead",
  "Interaction designer",
  "Design manager",
];

export const LOCATION_SUGGESTIONS = ["Chicago", "New York", "San Francisco", "Austin", "Seattle", "Remote (US)"];

export const HEADLINE_MAX_LENGTH = 120;
export const ABOUT_MAX_LENGTH = 600;
export const SALARY_STEP = 5_000;

export const PROFILE: Profile = {
  name: "Jordan Avery",
  headline: "Product designer focused on hiring tools",
  location: "Chicago, IL",
  about:
    "Eight years designing products that help people find work. I lead end-to-end design for search, applications, and recruiter workflows, and I care about systems that stay simple as they scale.",
  memberSince: "Member since 2024",
  status: { label: "Open to work", variant: "success" },
  targetRoles: ["Product designer", "Content designer"],
  locations: ["Chicago", "Remote (US)"],
  workplace: "hybrid",
  salaryFloor: 140_000,
  currency: "USD",
  authorization: "us-citizen",
  noticePeriod: "2w",
  skills: ["Product strategy", "Design systems", "Prototyping", "User research", "Figma", "Accessibility"],
  visibility: { openToWork: true, recruiterSearch: true, hideFromEmployer: true },
};

export const EXPERIENCE: ExperienceItem[] = [
  {
    id: "exp-1",
    role: "Senior Product Designer",
    company: "Fieldnote",
    period: "2022 — Present",
    summary: "Leads design for candidate search and the recruiter inbox. Shipped a unified design system across web and mobile.",
    current: true,
  },
  {
    id: "exp-2",
    role: "Product Designer",
    company: "Harbor",
    period: "2019 — 2022",
    summary: "Owned the application flow end to end. Cut drop-off on mobile applications by a third.",
  },
  {
    id: "exp-3",
    role: "UX Designer",
    company: "Lumen Health",
    period: "2017 — 2019",
    summary: "Designed patient scheduling and intake tools used across 40 clinics.",
  },
];

export const STRENGTH_STEPS: StrengthStep[] = [
  { id: "headline", label: "Add a headline", done: true },
  { id: "roles", label: "Choose target roles", done: true },
  { id: "resume", label: "Upload a default resume", done: true },
  { id: "experience", label: "Add work experience", done: true },
  { id: "verify", label: "Verify your identity", done: true },
  { id: "portfolio", label: "Link a portfolio", done: false },
  { id: "references", label: "Add two references", done: false },
];

export const VISIBILITY_SETTINGS: VisibilitySetting[] = [
  {
    key: "openToWork",
    label: "Open to work",
    description: "Show companies that you are actively looking.",
  },
  {
    key: "recruiterSearch",
    label: "Appear in recruiter search",
    description: "Verified recruiters can find your profile.",
  },
  {
    key: "hideFromEmployer",
    label: "Hide from current employer",
    description: "Fieldnote can’t see your profile or activity.",
  },
];

export function formatSalary(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function optionLabel(options: Option[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function strengthPercent(steps: StrengthStep[]) {
  return Math.round((steps.filter((step) => step.done).length / steps.length) * 100);
}
