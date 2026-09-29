import type {
  ApplicationRecord,
  ApplicationStatus,
  DailyPoint,
  Invoice,
  InvoiceLine,
} from "@/src/client/types/hunter";

import { MOCK_NOW, MS_PER_DAY } from "@/src/client/data/clock";
import { dayKey, ratio } from "@/src/client/lib/format";

export type StatusCounts = Record<ApplicationStatus, number>;

export const EMPTY_COUNTS: StatusCounts = {
  queued: 0,
  in_progress: 0,
  submitted: 0,
  qa_passed: 0,
  returned: 0,
  failed: 0,
};

export function countStatuses(applications: ApplicationRecord[]): StatusCounts {
  const counts = { ...EMPTY_COUNTS };
  for (const application of applications) counts[application.status] += 1;
  return counts;
}

/** Links a bidder has actually delivered (anything past "in progress" except failures). */
export const deliveredCount = (counts: StatusCounts) =>
  counts.submitted + counts.qa_passed + counts.returned;
export const settledCount = (counts: StatusCounts) =>
  counts.qa_passed + counts.returned + counts.failed;
export const qaRate = (counts: StatusCounts) =>
  ratio(counts.qa_passed, counts.qa_passed + counts.returned);

const DELIVERED: ApplicationStatus[] = ["submitted", "qa_passed", "returned"];

export function dailySeries(
  applications: ApplicationRecord[],
  days: number,
  target: number,
): DailyPoint[] {
  const points = new Map<string, DailyPoint>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = dayKey(MOCK_NOW.getTime() - offset * MS_PER_DAY);
    points.set(date, { date, submitted: 0, qaPassed: 0, target });
  }
  for (const application of applications) {
    const point = points.get(dayKey(application.updatedAt));
    if (!point || !DELIVERED.includes(application.status)) continue;
    point.submitted += 1;
    if (application.status === "qa_passed") point.qaPassed += 1;
  }
  return [...points.values()];
}

export const groupBy = <T>(items: T[], key: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
};

export const lineAmount = (line: InvoiceLine) => Math.round(line.links * line.rate * 100) / 100;
export const sumLines = (lines: InvoiceLine[]) =>
  lines.reduce((sum, line) => sum + lineAmount(line), 0);

export function invoiceTotals(invoice: Invoice, lines: InvoiceLine[]) {
  const own = lines.filter((line) => line.invoiceId === invoice.id);
  return {
    lines: own,
    links: own.reduce((sum, line) => sum + line.links, 0),
    amount: sumLines(own),
  };
}
