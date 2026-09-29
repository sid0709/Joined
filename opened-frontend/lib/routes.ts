export const BRAND = "Opened";

export const ROUTES = {
  search: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  hiringSetup: "/hiring/setup",
  applications: "/applications",
  interviews: "/interviews",
  messages: "/messages",
  resumes: "/resumes",
  profile: "/profile",
  settings: "/settings",
  job: (id: string) => `/jobs/${id}`,
  companyPublic: (id: string) => `/companies/${id}`,
  company: "/company",
  companyJobs: "/company/jobs",
  companyJobNew: "/company/jobs/new",
  companyJobEdit: (id: string) => `/company/jobs/${encodeURIComponent(id)}/edit`,
  companyApplicants: "/company/applicants",
  companyInterviews: "/company/interviews",
  companyAbout: "/company/about",
  companyTeam: "/company/team",
  companyBilling: "/company/billing",
  companyAnalytics: "/company/analytics",
  companySettings: "/company/settings",
  companyProfile: "/company/profile",
  companyAccount: "/company/account",
  companyMessages: "/company/messages",
  schedule: (id: string) => `/schedule/${encodeURIComponent(id)}`,
} as const;

/** Sign in, then come back to `path`. */
export function signInHref(path: string) {
  return `${ROUTES.signIn}?next=${encodeURIComponent(path)}`;
}

/** Sign up with the hiring path preselected. */
export const HIRING_SIGN_UP_HREF = `${ROUTES.signUp}?intent=hiring`;

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

export const MESSAGES_PAGE: PageLink = {
  href: ROUTES.messages,
  label: "Messages",
  description: "Conversations with companies, and notes from Opened.",
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

export const COMPANY_ANALYTICS_PAGE: PageLink = {
  href: ROUTES.companyAnalytics,
  label: "Analytics",
  description: "Funnel conversion, source mix, time-in-stage, and attendance.",
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

export const COMPANY_MESSAGES_PAGE: PageLink = {
  href: ROUTES.companyMessages,
  label: "Messages",
  description: "Threads with candidates.",
};

export const COMPANY_SETTINGS_PAGE: PageLink = {
  href: ROUTES.companySettings,
  label: "Settings",
  description: "Domains, notifications, and hiring defaults.",
};

/** You, in the hiring workspace — not the company. The company's own page is COMPANY_ABOUT_PAGE. */
export const COMPANY_PROFILE_PAGE: PageLink = {
  href: ROUTES.companyProfile,
  label: "My profile",
  description: "How candidates and teammates see you, and how you like to interview.",
};

/** Your own sign-in, notifications, and calendar. Company-wide rules live in COMPANY_SETTINGS_PAGE. */
export const COMPANY_ACCOUNT_PAGE: PageLink = {
  href: ROUTES.companyAccount,
  label: "Account settings",
  description: "Your sign-in, what you’re notified about, and the calendar you interview from.",
};

/** Candidate ("hunter") or employer ("company") — each has its own shell, nav, and account menu. */
export type WorkspaceMode = "hunter" | "company";
