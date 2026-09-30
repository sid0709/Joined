import type {
  BidderApplication,
  BidderEarningsSnapshot,
  BidderOnboardingState,
  BidderPerformanceSnapshot,
} from "@/src/shared/types/bidder";

const now = new Date("2026-09-28T09:00:00-04:00");

function daysFromNow(days: number) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function log(
  id: string,
  action: BidderApplication["bidLog"][number]["action"],
  label: string,
  detail?: string,
) {
  return { id, action, label, detail, createdAt: daysFromNow(-1) };
}

export const INITIAL_BIDDER_APPLICATIONS: BidderApplication[] = [
  {
    id: "app-amazon-001",
    clientId: "client-aurora",
    clientName: "Aurora Talent Partners",
    clientInitials: "AT",
    companyName: "Amazon",
    jobTitle: "Senior Product Manager, Seller Experience",
    officialUrl: "https://www.amazon.jobs/en/jobs/demo-seller-experience",
    route: "Company site",
    deadline: daysFromNow(3),
    closingDate: daysFromNow(10),
    status: "claimed",
    claimedAt: daysFromNow(-1),
    claimExpiresAt: daysFromNow(0.02),
    rateText: "$0.05 per verified bid",
    locationText: "Seattle, WA · Hybrid",
    assignedResumeSha256: "sha256:product-leadership-20260918",
    skills: ["Product strategy", "Marketplace", "Experimentation"],
    summary:
      "Coordinate product improvements for seller onboarding, conversion, and marketplace trust.",
    clientRules: {
      profileName: "Product leadership profile v3",
      approvedResumeVersion: "Resume · Product Leadership · 2026-09-18",
      doNotApply: [
        "Do not claim direct Amazon employment",
        "Do not answer legal eligibility questions",
      ],
      savedAnswers: [{ question: "Years of product experience?", answer: "7+ years" }],
      rules: [
        "Use only approved experience facts",
        "Do not invent metrics",
        "Escalate unknown eligibility questions",
      ],
    },
    checklist: [
      { id: "profile", label: "Confirm approved profile", complete: true },
      { id: "resume", label: "Upload assigned resume version", complete: false },
      { id: "questions", label: "Review required questions", complete: false },
      { id: "evidence", label: "Capture submission evidence", complete: false },
    ],
    bidLog: [log("log-amazon-open", "opened", "Official job link opened")],
    evidenceFiles: [],
    clientQuestions: [],
    earningsText: "$0.05 pending QA",
  },
  {
    id: "app-meta-002",
    clientId: "client-northstar",
    clientName: "Northstar Recruiting Co.",
    clientInitials: "NR",
    companyName: "Meta",
    jobTitle: "Technical Program Manager, Integrity Operations",
    officialUrl: "https://www.metacareers.com/jobs/demo-integrity-operations",
    route: "Easy Apply",
    deadline: daysFromNow(5),
    closingDate: daysFromNow(14),
    status: "preparing",
    rateText: "$0.05 per verified bid",
    locationText: "Menlo Park, CA · Remote eligible",
    assignedResumeSha256: "sha256:program-operations-20260912",
    skills: ["Program management", "Risk operations", "Cross-functional delivery"],
    summary:
      "Lead operational programs that improve integrity workflows across a global product portfolio.",
    clientRules: {
      profileName: "Operations program profile v2",
      approvedResumeVersion: "Resume · Program Operations · 2026-09-12",
      doNotApply: ["Exclude roles requiring active security clearance"],
      savedAnswers: [{ question: "Preferred work model?", answer: "Remote or hybrid" }],
      rules: [
        "Match the job family before applying",
        "Use the role-specific resume",
        "Record every submission",
      ],
    },
    checklist: [
      { id: "profile", label: "Confirm approved profile", complete: true },
      { id: "resume", label: "Upload assigned resume version", complete: true },
      { id: "questions", label: "Review required questions", complete: false },
      { id: "evidence", label: "Capture submission evidence", complete: false },
    ],
    bidLog: [
      log("log-meta-open", "opened", "Official job link opened"),
      log(
        "log-meta-resume",
        "resume_uploaded",
        "Assigned resume uploaded",
        "Hash matches approved version",
      ),
    ],
    evidenceFiles: [],
    clientQuestions: [],
    earningsText: "$0.05 pending submission",
  },
  {
    id: "app-uber-003",
    clientId: "client-aurora",
    clientName: "Aurora Talent Partners",
    clientInitials: "AT",
    companyName: "Uber",
    jobTitle: "Operations Strategy Manager, Marketplace",
    officialUrl: "https://www.uber.com/careers/demo-marketplace-strategy",
    route: "Company site",
    deadline: daysFromNow(7),
    closingDate: daysFromNow(18),
    status: "needs_client_input",
    rateText: "$0.05 per verified bid",
    locationText: "New York, NY · Hybrid",
    assignedResumeSha256: "sha256:strategy-operations-20260915",
    skills: ["Operations strategy", "SQL", "Forecasting"],
    summary: "Improve marketplace supply and service quality across a fast-moving city portfolio.",
    clientRules: {
      profileName: "Operations strategy profile v4",
      approvedResumeVersion: "Resume · Strategy & Operations · 2026-09-15",
      doNotApply: ["Do not apply to roles requiring relocation before approval"],
      savedAnswers: [],
      rules: [
        "Ask before answering relocation questions",
        "Use measurable facts from the profile",
        "Attach confirmation evidence",
      ],
    },
    checklist: [
      { id: "profile", label: "Confirm approved profile", complete: true },
      { id: "resume", label: "Upload assigned resume version", complete: true },
      { id: "questions", label: "Resolve client question", complete: false },
      { id: "evidence", label: "Capture submission evidence", complete: false },
    ],
    bidLog: [
      log("log-uber-open", "opened", "Official job link opened"),
      log(
        "log-uber-question",
        "asked_client",
        "Client input requested",
        "Asked whether hybrid relocation is acceptable",
      ),
    ],
    evidenceFiles: [],
    clientQuestions: ["Should I answer yes to the relocation question for this hybrid role?"],
    earningsText: "$0.05 held until submission",
  },
  {
    id: "app-shopify-004",
    clientId: "client-northstar",
    clientName: "Northstar Recruiting Co.",
    clientInitials: "NR",
    companyName: "Shopify",
    jobTitle: "Senior Backend Developer, Commerce Foundations",
    officialUrl: "https://www.shopify.com/careers/demo-commerce-backend",
    route: "Company site",
    deadline: daysFromNow(9),
    closingDate: daysFromNow(22),
    status: "qa_passed",
    rateText: "$0.05 earned",
    locationText: "Canada · Remote",
    assignedResumeSha256: "sha256:backend-engineering-20260908",
    skills: ["Ruby", "GraphQL", "Distributed systems"],
    summary: "Build resilient APIs and services that power commerce for independent businesses.",
    clientRules: {
      profileName: "Backend engineering profile v5",
      approvedResumeVersion: "Resume · Backend Engineering · 2026-09-08",
      doNotApply: ["Do not claim Ruby experience not present in resume"],
      savedAnswers: [{ question: "Available start date?", answer: "Two weeks notice" }],
      rules: [
        "Use the backend resume only",
        "Check location before submitting",
        "Save the confirmation reference",
      ],
    },
    checklist: [
      { id: "profile", label: "Confirm approved profile", complete: true },
      { id: "resume", label: "Upload assigned resume version", complete: true },
      { id: "questions", label: "Review required questions", complete: true },
      { id: "evidence", label: "Capture submission evidence", complete: true },
    ],
    bidLog: [
      log("log-shopify-open", "opened", "Official job link opened"),
      log("log-shopify-submit", "submitted", "Application submitted"),
      log(
        "log-shopify-evidence",
        "evidence_captured",
        "Confirmation evidence captured",
        "Confirmation ID: SHP-20481",
      ),
    ],
    evidenceFiles: ["shopify-confirmation.png"],
    clientQuestions: [],
    earningsText: "$0.05 released",
  },
];

export const INITIAL_BIDDER_ONBOARDING: BidderOnboardingState = {
  identity: "verified",
  skillsTest: "passed",
  taxInfo: "complete",
  terms: "accepted",
  rulesTraining: "in_progress",
};

export const INITIAL_BIDDER_PERFORMANCE: BidderPerformanceSnapshot = {
  level: "Rising",
  quota: 70,
  quotaUsed: 38,
  applicationsToday: 38,
  interviewsThisWeek: 5,
  qaPassRate: 97,
  notRelevantRate: 1.8,
  levelProgress: 68,
};

export const INITIAL_BIDDER_EARNINGS: BidderEarningsSnapshot = {
  pendingCents: 1250,
  heldCents: 500,
  releasedCents: 7850,
  paidCents: 12400,
  perBidCents: 5,
  perInterviewCents: 2500,
};
