// Sign in with Google, shared by joined-frontend, scoutwell-frontend, and
// admin-frontend. Each app keeps two thin route handlers (its route and the
// callback under it) that own its cookies; the API calls and decisions live here.
export { finishGoogleSignIn, seeOther, signInErrorPath, startGoogleSignIn } from "./flow";
export type { GoogleFinished, GoogleStarted } from "./flow";
export { GOOGLE_ERROR_PARAM, googleErrorMessage } from "./messages";
export type { GoogleSignInError } from "./messages";
export {
  GOOGLE_AUTH_ROUTE,
  GOOGLE_CALLBACK_ROUTE,
  GOOGLE_SIGNIN_ROUTE,
  googleCallbackRoute,
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_MAX_AGE_SECONDS,
  decodeGoogleState,
  encodeGoogleState,
  googleStateCookie,
  sameSiteNextPath,
} from "./state";
export type { GoogleState } from "./state";
