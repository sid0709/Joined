/** Why a Google sign-in ended back on the sign-in page. */
export type GoogleSignInError =
  "cancelled" | "expired" | "wrong_account" | "unavailable" | "failed";

/** The sign-in page's query parameter that carries a GoogleSignInError. */
export const GOOGLE_ERROR_PARAM = "google";

const MESSAGES: Record<GoogleSignInError, string> = {
  cancelled: "Google sign-in was cancelled.",
  expired: "That Google sign-in timed out. Try again.",
  wrong_account:
    "This Google account’s email belongs to a different kind of account, or is linked to another Google account. Sign in where that account belongs.",
  unavailable: "Sign in with Google isn’t available right now. Try again soon.",
  failed: "Couldn’t sign in with Google. Try again.",
};

/** The banner for a sign-in page's `?google=` value, or "" when there is none. */
export function googleErrorMessage(code: string | null | undefined): string {
  return code && code in MESSAGES ? MESSAGES[code as GoogleSignInError] : "";
}
