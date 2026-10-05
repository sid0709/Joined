import { DUPLICATE_WINDOW_DAYS, SCRAPE_SOURCE } from "../../config/env";

/** A job routine's record, plus the fields the extension adds, as POST /jobs/ingest expects. */
export function toJobPayload(record) {
  return {
    ...record,
    createdBy: SCRAPE_SOURCE,
    id: Date.now(),
    duplicateWindowDays: DUPLICATE_WINDOW_DAYS,
  };
}
