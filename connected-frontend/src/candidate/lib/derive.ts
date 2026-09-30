import type {
  BidderApplication,
  BidderAssignment,
  Payout,
  WalletTransaction,
} from "@/src/candidate/types/workspace";

import { BOARD_TASK_BY_ID } from "@/src/candidate/data/board";
import { countStatuses, qaRate } from "@/src/shared/lib/selectors";
import { MOCK_NOW, MS_PER_DAY } from "@/src/shared/mock/clock";

export const PLATFORM_FEE = 0.08;
export const MIN_EARLY_PAYOUT = 10;
const PAYOUT_LAG_DAYS = 11;

const round = (value: number) => Math.round(value * 100) / 100;
const mondayOf = (iso: string) => {
  const date = new Date(iso);
  const shift = (date.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - shift));
};

export function rateFor(application: BidderApplication, assignments: BidderAssignment[]) {
  return assignments.find((assignment) => assignment.id === application.assignmentId)?.rate ?? 0;
}

/** Weekly payouts per hunter, built from QA-passed applications. Paid on the Friday after the week closes. */
export function buildPayouts(
  applications: BidderApplication[],
  assignments: BidderAssignment[],
): Payout[] {
  const groups = new Map<
    string,
    { hunterId: string; monday: Date; links: number; gross: number }
  >();
  for (const application of applications) {
    if (application.status !== "qa_passed") continue;
    const hunterId = BOARD_TASK_BY_ID.get(application.taskId)?.hunterId;
    if (!hunterId) continue;
    const monday = mondayOf(application.updatedAt);
    const key = `${hunterId}:${monday.toISOString().slice(0, 10)}`;
    const group = groups.get(key) ?? { hunterId, monday, links: 0, gross: 0 };
    group.links += 1;
    group.gross += rateFor(application, assignments);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, group]): Payout => {
      const weekEnd = group.monday.getTime() + 7 * MS_PER_DAY;
      const payDate = group.monday.getTime() + PAYOUT_LAG_DAYS * MS_PER_DAY;
      const gross = round(group.gross);
      const status: Payout["status"] =
        payDate <= MOCK_NOW.getTime()
          ? "paid"
          : weekEnd <= MOCK_NOW.getTime()
            ? "processing"
            : "pending";
      return {
        id: `pay-${key}`,
        hunterId: group.hunterId,
        period: `${group.monday.toISOString().slice(0, 10)}`,
        links: group.links,
        gross,
        fee: round(gross * PLATFORM_FEE),
        status,
        issuedAt: new Date(weekEnd).toISOString(),
        paidAt: status === "paid" ? new Date(payDate).toISOString() : undefined,
        method: "Bank transfer",
      };
    })
    .sort((a, b) => b.period.localeCompare(a.period) || a.hunterId.localeCompare(b.hunterId));
}

export const payoutNet = (payout: Payout) => round(payout.gross - payout.fee);
export const sumNet = (payouts: Payout[]) =>
  round(payouts.reduce((sum, payout) => sum + payoutNet(payout), 0));

export function earningsSummary(
  applications: BidderApplication[],
  assignments: BidderAssignment[],
  payouts: Payout[],
  transactions: WalletTransaction[],
) {
  const paid = sumNet(payouts.filter((payout) => payout.status === "paid"));
  const processing = sumNet(payouts.filter((payout) => payout.status === "processing"));
  const scheduled = sumNet(payouts.filter((payout) => payout.status === "pending"));
  const awaitingGross = applications
    .filter((application) => application.status === "submitted")
    .reduce((sum, application) => sum + rateFor(application, assignments), 0);
  const sessionWithdrawn = transactions
    .filter((transaction) => transaction.id.startsWith("wt-new"))
    .reduce((sum, transaction) => sum - transaction.amount, 0);
  const bonuses = transactions
    .filter((transaction) => transaction.kind === "bonus")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return {
    paid: round(paid + bonuses),
    processing,
    scheduled,
    awaiting: round(awaitingGross * (1 - PLATFORM_FEE)),
    availableEarly: Math.max(0, round(processing - sessionWithdrawn)),
    lifetime: round(paid + processing + scheduled + bonuses),
  };
}

export function bidderQa(applications: BidderApplication[]) {
  return qaRate(countStatuses(applications));
}

export const applicationEarning = (
  application: BidderApplication,
  assignments: BidderAssignment[],
) => round(rateFor(application, assignments) * (1 - PLATFORM_FEE));

export const weeklyEstimate = (rate: number, dailyTarget: number, days = 5) =>
  round(rate * dailyTarget * days * (1 - PLATFORM_FEE));

export const hourlyRate = (rate: number, minutesPerLink: number) =>
  round((rate * (1 - PLATFORM_FEE) * 60) / minutesPerLink);
