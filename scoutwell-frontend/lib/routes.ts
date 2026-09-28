export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  submit: "/submit",
  submissions: "/submissions",
  submission: (id: string) => `/submissions/${id}`,
  earnings: "/earnings",
  level: "/level",
  payouts: "/payouts",
  notifications: "/notifications",
  account: "/account",
  developers: "/developers",
} as const;

export function signInHref(path: string) {
  return `${ROUTES.signIn}?next=${encodeURIComponent(path)}`;
}

/** Only same-site paths; anything else lands on the dashboard. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return ROUTES.dashboard;
  return value;
}

export type PageLink = {
  href: string;
  label: string;
  description: string;
};

export const DASHBOARD_PAGE: PageLink = {
  href: ROUTES.dashboard,
  label: "Overview",
  description: "How your jobs are performing.",
};

export const SUBMIT_PAGE: PageLink = {
  href: ROUTES.submit,
  label: "Submit a job",
  description: "Add an official apply link that is not already in the pool.",
};

export const SUBMISSIONS_PAGE: PageLink = {
  href: ROUTES.submissions,
  label: "Submissions",
  description: "Status, checks, and outcomes for every job you sent.",
};

export const EARNINGS_PAGE: PageLink = {
  href: ROUTES.earnings,
  label: "Earnings",
  description: "Held, available, and paid rewards.",
};

export const LEVEL_PAGE: PageLink = {
  href: ROUTES.level,
  label: "Level & limits",
  description: "Your daily limit, quality bars, and the next level.",
};

export const PAYOUTS_PAGE: PageLink = {
  href: ROUTES.payouts,
  label: "Payouts",
  description: "Verification, tax details, payout method, and transfers.",
};

export const NOTIFICATIONS_PAGE: PageLink = {
  href: ROUTES.notifications,
  label: "Notifications",
  description: "Decisions, rewards, and level changes.",
};

export const ACCOUNT_PAGE: PageLink = {
  href: ROUTES.account,
  label: "Account",
  description: "Your name and what we notify you about.",
};

export const DEVELOPERS_PAGE: PageLink = {
  href: ROUTES.developers,
  label: "API access",
  description: "Keys and docs for submitting jobs from your own systems.",
};
