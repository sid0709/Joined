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
} as const;
