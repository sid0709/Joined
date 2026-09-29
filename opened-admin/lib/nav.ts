import type { GlyphName } from "@openseat/design-system";

export const ROUTES = {
  scouting: "/scouting",
  queue: "/scouting/queue",
  submission: (id: string) => `/scouting/submissions/${id}`,
  scouts: "/scouting/scouts",
  scout: (userId: string) => `/scouting/scouts/${userId}`,
  payouts: "/scouting/payouts",
  jobs: "/jobs",
  tempJobs: "/jobs/temp",
  scoutJobs: "/jobs/scout",
  directReview: "/jobs/direct-review",
  directJob: (id: string) => `/jobs/direct-review/${id}`,
  companies: "/companies",
  companyVerification: "/trust/company-verification",
  companyCase: (id: string) => `/trust/company-verification/${id}`,
  cases: "/trust/cases",
  createCase: "/trust/cases/new",
  moderationCase: (id: string) => `/trust/cases/${id}`,
  reports: "/trust/reports",
  fileReport: "/trust/reports/new",
  report: (id: string) => `/trust/reports/${id}`,
  retentionOps: "/ops",
} as const;

export type NavLink = {
  href: string;
  label: string;
  icon: GlyphName;
  badge?: "queue" | "payouts" | "verifications" | "companyVerification" | "directReview" | "cases";
};

export const CONSOLE_NAV: { title: string; links: NavLink[] }[] = [
  {
    title: "Scouting",
    links: [
      { href: ROUTES.scouting, label: "Overview", icon: "home" },
      { href: ROUTES.queue, label: "Review queue", icon: "list", badge: "queue" },
      { href: ROUTES.scouts, label: "Scouts", icon: "users", badge: "verifications" },
      { href: ROUTES.payouts, label: "Payouts", icon: "file", badge: "payouts" },
    ],
  },
  {
    title: "Job pool",
    links: [
      { href: ROUTES.jobs, label: "Jobs", icon: "folder" },
      { href: ROUTES.tempJobs, label: "Temp", icon: "archive" },
      { href: ROUTES.scoutJobs, label: "Scout jobs", icon: "star" },
      { href: ROUTES.directReview, label: "Direct review", icon: "clock", badge: "directReview" },
    ],
  },
  {
    title: "Trust",
    links: [
      {
        href: ROUTES.companyVerification,
        label: "Company claims",
        icon: "check",
        badge: "companyVerification",
      },
      { href: ROUTES.cases, label: "Cases", icon: "bell", badge: "cases" },
      { href: ROUTES.reports, label: "Reports", icon: "chat" },
      { href: ROUTES.createCase, label: "Create case", icon: "plus" },
    ],
  },
  {
    title: "Ops",
    links: [{ href: ROUTES.retentionOps, label: "Retention", icon: "lock" }],
  },
  {
    title: "Directory",
    links: [{ href: ROUTES.companies, label: "Companies", icon: "seat" }],
  },
];

/** The deepest nav link that contains the path. */
export function activeHref(pathname: string) {
  return CONSOLE_NAV.flatMap((group) => group.links)
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
