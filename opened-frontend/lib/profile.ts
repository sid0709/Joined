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

export type HomeAddress = {
  line: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export type Profile = {
  name: string;
  email: string;
  phone: string;
  headline: string;
  location: string;
  homeAddress: HomeAddress;
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
  experience: ExperienceItem[];
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

export const LOCATION_SUGGESTIONS = [
  "Chicago",
  "New York",
  "San Francisco",
  "Austin",
  "Seattle",
  "Remote (US)",
];

export const SKILL_SUGGESTIONS = [
  "Product strategy",
  "Design systems",
  "Prototyping",
  "User research",
  "Figma",
  "Accessibility",
];

export const HEADLINE_MAX_LENGTH = 120;
export const ABOUT_MAX_LENGTH = 600;
export const SALARY_STEP = 5_000;
export const DEFAULT_CURRENCY = "USD";

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
    description: "Your current employer can’t see your profile or activity.",
  },
];

export function emptyAddress(): HomeAddress {
  return { line: "", city: "", region: "", postalCode: "", country: "" };
}

export function emptyProfile(): Profile {
  return {
    name: "",
    email: "",
    phone: "",
    headline: "",
    location: "",
    homeAddress: emptyAddress(),
    about: "",
    memberSince: "",
    status: { label: "Open to work", variant: "success" },
    targetRoles: [],
    locations: [],
    workplace: "hybrid",
    salaryFloor: 0,
    currency: DEFAULT_CURRENCY,
    authorization: "",
    noticePeriod: "",
    skills: [],
    experience: [],
    visibility: { openToWork: true, recruiterSearch: true, hideFromEmployer: false },
  };
}

export function normalizeProfile(value: Partial<Profile> | null | undefined): Profile {
  const base = emptyProfile();
  if (!value) return base;
  return {
    ...base,
    ...value,
    homeAddress: { ...base.homeAddress, ...value.homeAddress },
    targetRoles: value.targetRoles ?? [],
    locations: value.locations ?? [],
    skills: value.skills ?? [],
    experience: value.experience ?? [],
    visibility: { ...base.visibility, ...value.visibility },
    workplace: value.workplace || "hybrid",
    currency: value.currency || DEFAULT_CURRENCY,
  };
}

export function strengthSteps(profile: Profile, hasResume: boolean): StrengthStep[] {
  const address = profile.homeAddress;
  return [
    { id: "headline", label: "Add a headline", done: Boolean(profile.headline.trim()) },
    { id: "roles", label: "Choose target roles", done: profile.targetRoles.length > 0 },
    { id: "resume", label: "Upload a default resume", done: hasResume },
    { id: "experience", label: "Add work experience", done: profile.experience.length > 0 },
    { id: "phone", label: "Add a phone number", done: Boolean(profile.phone.trim()) },
    {
      id: "address",
      label: "Add a home address",
      done: Boolean(address.line.trim() && address.city.trim()),
    },
    { id: "location", label: "Set your location", done: Boolean(profile.location.trim()) },
  ];
}

export function formatSalary(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function optionLabel(options: Option[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function strengthPercent(steps: StrengthStep[]) {
  if (steps.length === 0) return 0;
  return Math.round((steps.filter((step) => step.done).length / steps.length) * 100);
}

export function formatAddress(address: HomeAddress) {
  return [address.line, address.city, address.region, address.postalCode, address.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}
