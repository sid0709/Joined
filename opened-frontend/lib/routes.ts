export const BRAND = "Opened";

export const ROUTES = {
  search: "/",
  applications: "/applications",
  interviews: "/interviews",
  messages: "/messages",
  resumes: "/resumes",
  profile: "/profile",
  settings: "/settings",
  job: (id: string) => `/jobs/${id}`,
  companyPublic: (slug: string) => `/companies/${slug}`,
  company: "/company",
  companyJobs: "/company/jobs",
  companyJobNew: "/company/jobs/new",
  companyApplicants: "/company/applicants",
  companyInterviews: "/company/interviews",
  companyAbout: "/company/about",
  companyTeam: "/company/team",
  companyBilling: "/company/billing",
  companySettings: "/company/settings",
} as const;

export type PageLink = {
  href: string;
  label: string;
  description: string;
};

export const APPLICATIONS_PAGE: PageLink = {
  href: ROUTES.applications,
  label: "My applications",
  description: "Every application, from saved through offer.",
};

export const INTERVIEWS_PAGE: PageLink = {
  href: ROUTES.interviews,
  label: "Interviews",
  description: "Upcoming and past interviews, including ones we detected.",
};

export const RESUMES_PAGE: PageLink = {
  href: ROUTES.resumes,
  label: "My resumes",
  description: "Upload a PDF or DOCX, keep labeled versions, and set a default.",
};

export const PROFILE_PAGE: PageLink = {
  href: ROUTES.profile,
  label: "Profile",
  description: "Target roles, locations, and work authorization.",
};

export const SETTINGS_PAGE: PageLink = {
  href: ROUTES.settings,
  label: "Settings",
  description: "Notifications, connected calendar, and privacy.",
};

export const HUNTER_LINKS: PageLink[] = [
  APPLICATIONS_PAGE,
  INTERVIEWS_PAGE,
  RESUMES_PAGE,
  PROFILE_PAGE,
  SETTINGS_PAGE,
];

export const COMPANY_HOME_PAGE: PageLink = {
  href: ROUTES.company,
  label: "Overview",
  description: "Open jobs, new applicants, interviews, and spend.",
};

export const COMPANY_JOBS_PAGE: PageLink = {
  href: ROUTES.companyJobs,
  label: "Jobs",
  description: "Create, pause, and close jobs. Posting is free.",
};

export const COMPANY_APPLICANTS_PAGE: PageLink = {
  href: ROUTES.companyApplicants,
  label: "Applicants",
  description: "Fit, verification, and who applied with help.",
};

export const COMPANY_INTERVIEWS_PAGE: PageLink = {
  href: ROUTES.companyInterviews,
  label: "Interviews",
  description: "Scheduled rounds, attendance, and face check.",
};

export const COMPANY_ABOUT_PAGE: PageLink = {
  href: ROUTES.companyAbout,
  label: "Company page",
  description: "The public page candidates see.",
};

export const COMPANY_TEAM_PAGE: PageLink = {
  href: ROUTES.companyTeam,
  label: "Team",
  description: "Owners, admins, recruiters, and viewers.",
};

export const COMPANY_BILLING_PAGE: PageLink = {
  href: ROUTES.companyBilling,
  label: "Billing",
  description: "You pay per interview, up to a monthly cap.",
};

export const COMPANY_SETTINGS_PAGE: PageLink = {
  href: ROUTES.companySettings,
  label: "Settings",
  description: "Domains, notifications, and hiring defaults.",
};

export const COMPANY_LINKS: PageLink[] = [
  COMPANY_HOME_PAGE,
  COMPANY_JOBS_PAGE,
  COMPANY_APPLICANTS_PAGE,
  COMPANY_INTERVIEWS_PAGE,
  COMPANY_ABOUT_PAGE,
  COMPANY_TEAM_PAGE,
  COMPANY_BILLING_PAGE,
  COMPANY_SETTINGS_PAGE,
];

/** Pages that belong to both modes, so opening them keeps the current mode. */
export const SHARED_PREFIXES = [ROUTES.messages] as const;

export type WorkspaceMode = "hunter" | "company";

export function modeFromPath(pathname: string): WorkspaceMode | null {
  if (pathname === ROUTES.company || pathname.startsWith(`${ROUTES.company}/`)) return "company";
  if (SHARED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;
  return "hunter";
}
