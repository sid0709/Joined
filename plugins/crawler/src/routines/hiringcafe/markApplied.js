import { MARK_APPLIED, MARK_APPLIED_ENABLED, MARK_APPLIED_TEXT } from "./constants.js";

/**
 * TODO: Mark Applied needs a signed-in session. The hover overlay is absent
 * from the DOM until the card is hovered, and clicking it signed-out only
 * opens a sign-in dialog. Do not use this as the handled marker.
 */
export function isMarkAppliedEnabled() {
  return MARK_APPLIED_ENABLED === true;
}

export async function markAppliedIfEnabled(call, { skipDelays = false, rest } = {}) {
  if (!isMarkAppliedEnabled()) return false;
  const result = await call("click", { selector: MARK_APPLIED, contains: MARK_APPLIED_TEXT });
  if (!skipDelays && typeof rest === "function") await rest(250);
  return Boolean(result?.found);
}
