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
