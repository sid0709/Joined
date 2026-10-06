/**
 * User-facing copy the email journey asserts.
 * Matches joined-frontend email screens; keep generic so login cannot enumerate accounts.
 */

export const EMAIL_AUTH_COPY = {
  signUpHeading: "Create your account",
  signInHeading: "Sign in",
  checkEmailHeading: "Check your email",
  verifyHeading: "Verify email",
  forgotHeading: "Forgot password",
  resetHeading: "Reset password",
  createAccountEmail: "Create account with email",
  signInEmail: "Sign in with email",
  sendResetLink: "Send reset link",
  resetPassword: "Reset password",
  googleSignIn: "Continue with Google",
  googleSignUp: "Sign up with Google",
  signOut: "Sign out",
  guestSignIn: "Sign in",
  createAccount: "Create account",
  applicationsNav: "My applications",
  loginFailed: "Email or password is incorrect.",
  verifySuccess: "Email verified. You can now sign in.",
  forgotSuccess: "If that email is registered, a password reset link has been sent.",
  resetUpdated: "Password updated. Sign in with your new password.",
  continueToSignIn: "Continue to sign in",
  nameLabel: "Name",
  emailLabel: "Email",
  passwordLabel: "Password",
  newPasswordLabel: "New password",
  confirmPasswordLabel: "Confirm password",
} as const;

export const SEEKER_COPY = {
  searchHeading: "Find your next role",
  searchRole: "Search jobs",
  applicationsHeading: "My applications",
  pricingHeading: "Premium",
  testMode: "Stripe test mode",
  checkoutPaused: "Checkout is paused",
  upgrade: "Upgrade",
  seePlans: "See plans",
  signInToUpgrade: "Sign in to upgrade",
  createJobAlert: "Create job alert",
  saveSearchTitle: "Save this search",
  saveSearch: "Save",
  searchName: "Name",
  saveJob: "Save job",
  billingTestMode: "Joined Premium is billed through Stripe in test mode.",
} as const;

/** Named reason when this suite must not open Stripe Checkout. */
export const CHECKOUT_SKIP_REASON =
  "Stripe test card is not entered here. CI does not receive a test secret in the repo, and this spec never follows a Checkout URL.";
