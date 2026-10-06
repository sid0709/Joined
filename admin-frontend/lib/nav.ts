import type { GlyphName } from "sid-ui";

export const ROUTES = {
  signIn: "/sign-in",
  signOut: "/auth/sign-out",
  scouting: "/scouting",
  queue: "/scouting/queue",
  submission: (id: string) => `/scouting/submissions/${id}`,
  scouts: "/scouting/scouts",
  scout: (userId: string) => `/scouting/scouts/${userId}`,
  payouts: "/scouting/payouts",
  jobs: "/jobs",
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
  users: "/users",
  user: (id: string) => `/users/${id}`,
  fileReport: "/trust/reports/new",
  report: (id: string) => `/trust/reports/${id}`,
  retentionOps: "/ops",
  jobMigration: "/migration/jobs",
  companyMigration: "/migration/companies",
  acornAI: "/settings/acorn-ai",
  deepSeek: "/settings/deepseek",
} as const;

export type NavLink = {
  href: string;
  label: string;
  icon: GlyphName;
  badge?: "queue" | "payouts" | "verifications" | "companyVerification" | "directReview" | "cases";
};

export const CONSOLE_NAV: { title: string; links: NavLink[] }[] = [
  {
    title: "Users",
    links: [{ href: ROUTES.users, label: "Users", icon: "users" }],
  },
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
  {
    title: "Migration",
    links: [
      { href: ROUTES.jobMigration, label: "Jobs", icon: "archive" },
      { href: ROUTES.companyMigration, label: "Companies", icon: "download" },
    ],
  },
  {
    title: "Settings",
    links: [
      { href: ROUTES.acornAI, label: "Acorn AI", icon: "settings" },
      { href: ROUTES.deepSeek, label: "DeepSeek", icon: "sparkle" },
    ],
  },
];

/** Sign in, then come back to path. */
export function signInHref(path: string | null | undefined) {
  return path ? `${ROUTES.signIn}?next=${encodeURIComponent(path)}` : ROUTES.signIn;
}

/** The deepest nav link that contains the path. */
export function activeHref(pathname: string) {
  return CONSOLE_NAV.flatMap((group) => group.links)
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
