import { SCRAPE_OUTCOMES } from "../../api/scrapeRunStats";

export function isIngestAccepted(outcome) {
  return outcome === SCRAPE_OUTCOMES.REGISTERED || outcome === SCRAPE_OUTCOMES.DUPLICATE;
}

export function isIngestRejected(outcome) {
  return outcome === SCRAPE_OUTCOMES.FAILED || outcome === SCRAPE_OUTCOMES.VALIDATION;
}

/** true when registered/duplicate, false when rejected, null on timeout or any other outcome. */
export function ingestAcceptFromOutcome(outcome) {
  if (!outcome) return null;
  if (isIngestRejected(outcome)) return false;
  if (isIngestAccepted(outcome)) return true;
  return null;
}
