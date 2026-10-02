import type { Option } from "@/lib/profile";

/**
 * Choices for personal details and voluntary disclosures. Values are what the API
 * stores and what Acorn reads to answer application forms, so keep them descriptive
 * and stable; "decline" tells Acorn to pick the form's own decline option.
 */
export const DECLINE_VALUE = "decline";
const DECLINE: Option = { value: DECLINE_VALUE, label: "Prefer not to say" };

export const GENDER_OPTIONS: Option[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  DECLINE,
];

export const PRONOUN_OPTIONS: Option[] = [
  { value: "he/him", label: "he/him" },
  { value: "she/her", label: "she/her" },
  { value: "they/them", label: "they/them" },
  DECLINE,
];

export const ORIENTATION_OPTIONS: Option[] = [
  { value: "heterosexual", label: "Heterosexual" },
  { value: "gay-or-lesbian", label: "Gay or lesbian" },
  { value: "bisexual", label: "Bisexual" },
  { value: "other", label: "Another orientation" },
  DECLINE,
];

export const CITIZENSHIP_OPTIONS: Option[] = [
  { value: "us-citizen", label: "U.S. citizen" },
  { value: "us-permanent-resident", label: "U.S. permanent resident (green card)" },
  { value: "us-work-visa", label: "U.S. work visa (H-1B, L-1, O-1, TN…)" },
  { value: "us-student-visa", label: "U.S. student visa (F-1, OPT, CPT)" },
  { value: "non-us-citizen", label: "Not authorized to work in the U.S." },
];

export const HISPANIC_OPTIONS: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  DECLINE,
];

export const RACE_OPTIONS: Option[] = [
  { value: "american-indian-or-alaska-native", label: "American Indian or Alaska Native" },
  { value: "asian", label: "Asian" },
  { value: "black-or-african-american", label: "Black or African American" },
  { value: "native-hawaiian-or-pacific-islander", label: "Native Hawaiian or Pacific Islander" },
  { value: "white", label: "White" },
  { value: "two-or-more-races", label: "Two or more races" },
  DECLINE,
];

export const SPONSORSHIP_OPTIONS: Option[] = [
  { value: "not-required", label: "No — no sponsorship needed" },
  { value: "required", label: "Yes — needs sponsorship now" },
  { value: "required-in-future", label: "Not now — will need it in the future" },
];

export const DISABILITY_OPTIONS: Option[] = [
  { value: "no", label: "No — no disability" },
  { value: "yes", label: "Yes — has a disability" },
  DECLINE,
];

export const VETERAN_OPTIONS: Option[] = [
  { value: "not-protected-veteran", label: "I am not a protected veteran" },
  { value: "protected-veteran", label: "I am a protected veteran" },
  DECLINE,
];

export const MONTH_OPTIONS: Option[] = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: new Date(2000, index, 1).toLocaleString("en-US", { month: "short" }),
}));

/** Ages a job application can ask for. */
export const MIN_AGE = 14;
export const MAX_AGE = 100;
/** Years a role or school can start or end. */
export const MIN_YEAR = 1940;
export const MAX_YEAR = 2100;
