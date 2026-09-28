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
  companies: "/companies",
} as const;

export type NavLink = {
  href: string;
  label: string;
  icon: GlyphName;
  badge?: "queue" | "payouts" | "verifications";
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
    ],
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
