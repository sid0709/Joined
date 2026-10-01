// Sign in with Google, shared by joined-frontend and scoutwell-frontend. Each app
// keeps two thin route handlers (GOOGLE_SIGNIN_ROUTE and GOOGLE_CALLBACK_ROUTE)
// that own its cookies; the API calls and decisions live here.
export { finishGoogleSignIn, seeOther, signInErrorPath, startGoogleSignIn } from "./flow";
export type { GoogleFinished, GoogleStarted } from "./flow";
export { GOOGLE_ERROR_PARAM, googleErrorMessage } from "./messages";
export type { GoogleSignInError } from "./messages";
export {
  GOOGLE_CALLBACK_ROUTE,
  GOOGLE_SIGNIN_ROUTE,
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_MAX_AGE_SECONDS,
  decodeGoogleState,
  encodeGoogleState,
  googleStateCookie,
} from "./state";
export type { GoogleState } from "./state";
