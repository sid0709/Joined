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
} as const;

export function signInHref(path: string) {
  return `${ROUTES.signIn}?next=${encodeURIComponent(path)}`;
}

export type PageLink = {
  href: string;
  label: string;
  description: string;
};

export const DASHBOARD_PAGE: PageLink = {
  href: ROUTES.dashboard,
  label: "Overview",
  description: "How your jobs are performing today.",
};

export const SUBMIT_PAGE: PageLink = {
  href: ROUTES.submit,
  label: "Submit a job",
  description: "Add an official apply link that is not already in the pool.",
};

export const SUBMISSIONS_PAGE: PageLink = {
  href: ROUTES.submissions,
  label: "My submissions",
  description: "Status, applications, interviews, and hires per job.",
};

export const EARNINGS_PAGE: PageLink = {
  href: ROUTES.earnings,
  label: "Earnings",
  description: "Held, released, and paid rewards.",
};

export const LEVEL_PAGE: PageLink = {
  href: ROUTES.level,
  label: "Level & limits",
  description: "Daily cap, quality metrics, and the next level.",
};

export const PAYOUTS_PAGE: PageLink = {
  href: ROUTES.payouts,
  label: "Payouts",
  description: "Tax info, payout method, and transfers.",
};

export const NOTIFICATIONS_PAGE: PageLink = {
  href: ROUTES.notifications,
  label: "Notifications",
  description: "Submission decisions, rewards, and level changes.",
};

export const ACCOUNT_PAGE: PageLink = {
  href: ROUTES.account,
  label: "Account",
  description: "Profile, verification, and demo data.",
};

export function safeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return ROUTES.dashboard;
  return value;
}
