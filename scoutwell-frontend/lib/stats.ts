import { CURRENCY } from "./config";
import { earningsTotals } from "./rewards";
import { levelMetrics } from "./levels";
import type { Earning, ScoutAccount, ScoutNotification, Submission } from "./types";

export function ownedBy<T extends { scoutUserId: string }>(items: T[], userId: string) {
  return items.filter((item) => item.scoutUserId === userId);
}

export function dashboardStats(
  account: ScoutAccount,
  submissions: Submission[],
  earnings: Earning[],
  notifications: ScoutNotification[],
) {
  const mine = ownedBy(submissions, account.id);
  const mineEarnings = ownedBy(earnings, account.id);
  const metrics = levelMetrics(account, mine);
  const totals = earningsTotals(mineEarnings);
  const live = mine.filter((item) => item.status === "approved" && !item.expired);
  return {
    metrics,
    totals,
    liveJobs: live.length,
    interviews: live.reduce((sum, item) => sum + item.interviews, 0),
    applications: live.reduce((sum, item) => sum + item.applications, 0),
    unread: ownedBy(notifications, account.id).filter((item) => item.unread).length,
    currency: CURRENCY,
  };
}
