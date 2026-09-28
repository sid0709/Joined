import { LEVELS, PROMOTION, type ScoutLevel } from "./config";
import { percent } from "./format";
import { isSameLocalDay } from "./dates";
import type { ScoutAccount, Submission } from "./types";

export type LevelMetrics = {
  submitted: number;
  approved: number;
  rejected: number;
  duplicate: number;
  expired: number;
  withInterview: number;
  approvalRate: number;
  duplicateExpiredRate: number;
  interviewProducingRate: number;
  submittedToday: number;
  dailyLimit: number;
  remainingToday: number;
};

export function levelMetrics(account: ScoutAccount, submissions: Submission[]): LevelMetrics {
  const mine = submissions.filter((item) => item.scoutUserId === account.id);
  const decided = mine.filter((item) => item.status === "approved" || item.status === "rejected");
  const approved = mine.filter((item) => item.status === "approved");
  const duplicate = mine.filter((item) => item.status === "duplicate");
  const expired = mine.filter((item) => item.expired);
  const withInterview = approved.filter((item) => item.interviews > 0);
  const submittedToday = mine.filter((item) => isSameLocalDay(item.submittedAt)).length;
  const dailyLimit = LEVELS[account.level].dailyLimit;
  const approvalRate = percent(approved.length, decided.length) / 100;
  const duplicateExpiredRate = percent(duplicate.length + expired.length, mine.length) / 100;
  const interviewProducingRate = percent(withInterview.length, approved.length) / 100;

  return {
    submitted: mine.length,
    approved: approved.length,
    rejected: mine.filter((item) => item.status === "rejected").length,
    duplicate: duplicate.length,
    expired: expired.length,
    withInterview: withInterview.length,
    approvalRate,
    duplicateExpiredRate,
    interviewProducingRate,
    submittedToday,
    dailyLimit,
    remainingToday: Math.max(0, dailyLimit - submittedToday),
  };
}

export function meetsPromotion(metrics: LevelMetrics) {
  return (
    metrics.approved >= PROMOTION.minApproved &&
    metrics.approvalRate >= PROMOTION.minApprovalRate &&
    metrics.duplicateExpiredRate <= PROMOTION.maxDuplicateExpiredRate &&
    metrics.interviewProducingRate >= PROMOTION.minInterviewProducingRate
  );
}

export function nextLevel(level: ScoutLevel): ScoutLevel | null {
  if (level === "probation") return "trusted";
  if (level === "trusted") return "expert";
  return null;
}

export function recomputeLevel(level: ScoutLevel, metrics: LevelMetrics): ScoutLevel {
  if (level === "expert" && !meetsPromotion(metrics)) return "trusted";
  if (level === "probation" && meetsPromotion(metrics)) return "trusted";
  if (level === "trusted" && meetsPromotion(metrics)) return "expert";
  return level;
}

export function canSubmitToday(account: ScoutAccount, submissions: Submission[]) {
  return levelMetrics(account, submissions).remainingToday > 0;
}
