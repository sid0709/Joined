import { DUPLICATE_WINDOW_DAYS, SCRAPE_SOURCE } from "../../config/env";

/**
 * A job routine's record, plus the fields the extension adds, as the admin API's crawler
 * ingest expects. `source` names the board: the routine's id, e.g. "jobright".
 */
export function toJobPayload(record, routine) {
  return {
    ...record,
    createdBy: SCRAPE_SOURCE,
    source: routine?.id ?? "",
    id: Date.now(),
    duplicateWindowDays: DUPLICATE_WINDOW_DAYS,
  };
}
