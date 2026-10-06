/** joined-frontend auth paths. Keep in lockstep with `joined-frontend/lib/routes.ts`. */

export const AUTH_TOKEN_PARAM = "token";

export const AUTH_PATHS = {
  signIn: "/sign-in",
  signUp: "/sign-up",
  checkEmail: "/check-email",
  verify: "/verify",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  search: "/",
  applications: "/applications",
  pricing: "/pricing",
  settingsBilling: "/settings?section=billing",
} as const;

export function jobPath(id: string) {
  return `/jobs/${encodeURIComponent(id)}`;
}
