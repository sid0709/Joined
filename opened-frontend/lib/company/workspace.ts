import { companyBySlug, type CompanyProfile } from "@/lib/jobs";

/** Hiring workspace — the company this hiring workspace belongs to. Sample data until the API lands. */

export const WORKSPACE_SLUG = "northwind";

export type Workspace = CompanyProfile & {
  tagline: string;
  website: string;
  verified: boolean;
  perks: string[];
};

const BASE = companyBySlug(WORKSPACE_SLUG) as CompanyProfile;

export const WORKSPACE: Workspace = {
  ...BASE,
  tagline: "Design and data teams, embedded in the products people use every day.",
  website: "northwind.example",
  verified: true,
  perks: [
    "Hybrid, 2 days in office",
    "Learning budget $2,000/yr",
    "16 weeks parental leave",
    "Home office stipend",
  ],
};
