import type { PackageTier } from "@/src/shared/types/marketplace";

/** Rate cards. Harder application systems cost more per submitted link. */
export const PACKAGE_TIERS: PackageTier[] = [
  {
    id: "pkg-greenhouse",
    name: "Greenhouse Starter",
    ats: ["Greenhouse"],
    difficulty: "Easy",
    ratePerLink: 0.8,
    minutesPerLink: 6,
    turnaround: "Same day",
    description:
      "Single-page forms with reusable screening answers. Fast to apply, cheapest per link.",
  },
  {
    id: "pkg-startup",
    name: "Lever & Ashby Standard",
    ats: ["Lever", "Ashby"],
    difficulty: "Standard",
    ratePerLink: 1.25,
    minutesPerLink: 9,
    turnaround: "24 hours",
    description: "Startup ATS forms with short-answer questions and portfolio or LinkedIn fields.",
  },
  {
    id: "pkg-smartrecruiters",
    name: "SmartRecruiters Standard",
    ats: ["SmartRecruiters"],
    difficulty: "Standard",
    ratePerLink: 1.1,
    minutesPerLink: 10,
    turnaround: "24 hours",
    description: "Multi-section forms with consent screens and EEO questions.",
  },
  {
    id: "pkg-workday",
    name: "Workday Professional",
    ats: ["Workday"],
    difficulty: "Standard",
    ratePerLink: 1.35,
    minutesPerLink: 14,
    turnaround: "2 business days",
    description: "Account creation, resume parsing corrections, and multi-step profile forms.",
  },
  {
    id: "pkg-icims",
    name: "iCIMS Specialist",
    ats: ["iCIMS"],
    difficulty: "Advanced",
    ratePerLink: 1.85,
    minutesPerLink: 20,
    turnaround: "3 business days",
    description:
      "Long-form applications with eligibility screening, references, and repeated data entry.",
  },
];

export const PACKAGE_BY_ID = new Map(PACKAGE_TIERS.map((tier) => [tier.id, tier]));
