import {
  CONVERSION_SHARE,
  CURRENCY,
  HOLD_DAYS,
  HIRE_REWARD_CENTS,
  INTERVIEW_REWARD_CENTS,
  LEVELS,
  MAJOR_BOARD_APPROVAL_DISCOUNT,
  MIN_PAYOUT_CENTS,
  type Seniority,
} from "./config";
import { addDays } from "./dates";
import type { Earning, ScoutAccount, Submission } from "./types";

export function approvalRewardCents(level: ScoutAccount["level"], alreadyOnMajorBoards: boolean) {
  const base = LEVELS[level].approvalRewardCents;
  if (base <= 0) return 0;
  return alreadyOnMajorBoards ? Math.round(base * MAJOR_BOARD_APPROVAL_DISCOUNT) : base;
}

export function interviewRewardCents(level: ScoutAccount["level"], seniority: Seniority) {
  return Math.round(INTERVIEW_REWARD_CENTS[seniority] * LEVELS[level].interviewMultiplier);
}

export function hireRewardCents(seniority: Seniority) {
  return HIRE_REWARD_CENTS[seniority];
}

export function conversionRewardCents(companyFeeCents: number) {
  return Math.round(companyFeeCents * CONVERSION_SHARE);
}

export function holdUntil(createdAt: string) {
  return addDays(createdAt, HOLD_DAYS);
}

export function earningsTotals(earnings: Earning[]) {
  const sum = (status: Earning["status"]) =>
    earnings
      .filter((item) => item.status === status)
      .reduce((total, item) => total + item.amountCents, 0);
  return {
    heldCents: sum("held"),
    releasedCents: sum("released"),
    paidCents: sum("paid"),
    currency: CURRENCY,
  };
}

export function availablePayoutCents(earnings: Earning[]) {
  return earningsTotals(earnings).releasedCents;
}

export function canRequestPayout(account: ScoutAccount, earnings: Earning[]) {
  return (
    account.verificationTier >= 2 &&
    account.taxInfoComplete &&
    account.payoutMethod !== null &&
    availablePayoutCents(earnings) >= MIN_PAYOUT_CENTS
  );
}

export function rewardForSubmission(
  type: "approval" | "interview" | "hire",
  account: ScoutAccount,
  submission: Submission,
) {
  if (type === "approval")
    return approvalRewardCents(account.level, submission.alreadyOnMajorBoards);
  if (type === "interview") return interviewRewardCents(account.level, submission.seniority);
  return hireRewardCents(submission.seniority);
}
