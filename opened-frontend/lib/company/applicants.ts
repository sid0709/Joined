import type { BadgeVariant, KanbanColumn } from "@openseat/design-system";
import { daysFromToday } from "@/lib/dates";

/** Hiring workspace — applicants. Sample data until the API lands. */

export type ApplicantStage = "new" | "screening" | "interview" | "offer" | "hired" | "rejected";
export type AssistedBy = "direct" | "bidder" | "agent";

export type Applicant = {
  id: string;
  /** KanbanBoard reads the stage as its column. */
  columnId: ApplicantStage;
  name: string;
  headline: string;
  location: string;
  jobId: string;
  fit: number;
  verified: boolean;
  assisted: AssistedBy;
  resume: string;
  appliedOn: Date;
  experienceYears: number;
  lastCompany: string;
  skills: string[];
  /** Team score, 1–5, once someone has reviewed them. */
  rating?: number;
};

export const APPLICANT_STAGES: { id: ApplicantStage; title: string; badge: BadgeVariant }[] = [
  { id: "new", title: "New", badge: "info" },
  { id: "screening", title: "Screening", badge: "purple" },
  { id: "interview", title: "Interview", badge: "warning" },
  { id: "offer", title: "Offer", badge: "success" },
  { id: "hired", title: "Hired", badge: "success" },
  { id: "rejected", title: "Rejected", badge: "neutral" },
];

export const APPLICANT_STAGE_BY_ID = Object.fromEntries(
  APPLICANT_STAGES.map((stage) => [stage.id, stage]),
) as Record<ApplicantStage, (typeof APPLICANT_STAGES)[number]>;

export const APPLICANT_COLUMNS: KanbanColumn[] = APPLICANT_STAGES.map((stage) => ({
  id: stage.id,
  title: stage.title,
}));

export const ASSISTED_LABEL: Record<AssistedBy, string> = {
  direct: "Applied directly",
  bidder: "Prepared by a bidder",
  agent: "Prepared by the agent",
};

export const STRONG_FIT = 85;

export const APPLICANTS: Applicant[] = [
  {
    id: "a-1",
    columnId: "interview",
    name: "Alex Rivera",
    headline: "Product designer · hiring tools",
    location: "Chicago, IL",
    jobId: "cj-1",
    fit: 91,
    verified: true,
    assisted: "direct",
    resume: "General",
    appliedOn: daysFromToday(-9),
    experienceYears: 7,
    lastCompany: "Fieldnote",
    skills: ["Design systems", "Prototyping", "Research"],
    rating: 5,
  },
  {
    id: "a-2",
    columnId: "screening",
    name: "Dana Kim",
    headline: "Senior product designer",
    location: "Evanston, IL",
    jobId: "cj-1",
    fit: 84,
    verified: true,
    assisted: "agent",
    resume: "Design-focused",
    appliedOn: daysFromToday(-5),
    experienceYears: 9,
    lastCompany: "Harbor",
    skills: ["Interaction design", "Figma", "Accessibility"],
    rating: 4,
  },
  {
    id: "a-3",
    columnId: "new",
    name: "Priya Nair",
    headline: "Product designer, fintech",
    location: "Remote",
    jobId: "cj-1",
    fit: 88,
    verified: true,
    assisted: "direct",
    resume: "Portfolio",
    appliedOn: daysFromToday(0),
    experienceYears: 6,
    lastCompany: "Ledger",
    skills: ["Payments", "Prototyping", "Data viz"],
  },
  {
    id: "a-4",
    columnId: "new",
    name: "Marcus Brown",
    headline: "Visual designer moving into product",
    location: "Milwaukee, WI",
    jobId: "cj-1",
    fit: 72,
    verified: false,
    assisted: "bidder",
    resume: "General",
    appliedOn: daysFromToday(-1),
    experienceYears: 4,
    lastCompany: "Brightside",
    skills: ["Brand", "Illustration"],
  },
  {
    id: "a-5",
    columnId: "interview",
    name: "Riley Chen",
    headline: "Analyst, experimentation",
    location: "New York, NY",
    jobId: "cj-2",
    fit: 86,
    verified: true,
    assisted: "direct",
    resume: "General",
    appliedOn: daysFromToday(-7),
    experienceYears: 5,
    lastCompany: "Lumen Health",
    skills: ["SQL", "A/B testing", "Python"],
    rating: 4,
  },
  {
    id: "a-6",
    columnId: "new",
    name: "Sofia Alvarez",
    headline: "Data analyst · growth",
    location: "Brooklyn, NY",
    jobId: "cj-2",
    fit: 79,
    verified: true,
    assisted: "agent",
    resume: "General",
    appliedOn: daysFromToday(-2),
    experienceYears: 3,
    lastCompany: "Parcel",
    skills: ["SQL", "Looker"],
  },
  {
    id: "a-7",
    columnId: "offer",
    name: "Jamie Ortiz",
    headline: "Product designer, marketplaces",
    location: "Chicago, IL",
    jobId: "cj-1",
    fit: 93,
    verified: true,
    assisted: "direct",
    resume: "General",
    appliedOn: daysFromToday(-21),
    experienceYears: 8,
    lastCompany: "Outpost",
    skills: ["Marketplaces", "Systems thinking", "Workshops"],
    rating: 5,
  },
  {
    id: "a-8",
    columnId: "new",
    name: "Hannah Lee",
    headline: "Mixed-methods researcher",
    location: "Remote",
    jobId: "cj-3",
    fit: 90,
    verified: true,
    assisted: "direct",
    resume: "Research",
    appliedOn: daysFromToday(-1),
    experienceYears: 10,
    lastCompany: "Civic Labs",
    skills: ["Interviews", "Surveys", "Synthesis"],
  },
  {
    id: "a-9",
    columnId: "rejected",
    name: "Sam Okafor",
    headline: "Support team lead",
    location: "Remote",
    jobId: "cj-4",
    fit: 64,
    verified: false,
    assisted: "bidder",
    resume: "General",
    appliedOn: daysFromToday(-18),
    experienceYears: 6,
    lastCompany: "Helpline",
    skills: ["Zendesk", "Coaching"],
    rating: 2,
  },
];
