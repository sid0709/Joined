import { sampleApplications, type Application } from "./applications";
import { dayKey, type Day } from "./dates";

export type Activity = { today: Day; applications: Application[] };

/**
 * Today's applications for the signed-in account. Runs on the server so every client
 * view of one request agrees on "today". Sample data until acorn-backend reports history.
 */
export function loadActivity(): Activity {
  const today = dayKey(new Date());
  return { today, applications: sampleApplications(today) };
}
