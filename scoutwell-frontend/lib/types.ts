import type { ScoutLevel, Seniority } from "./config";

export type NotificationTone = "accent" | "success" | "warning" | "danger" | "neutral";

export type VerificationTier = 0 | 1 | 2;
export type SubmissionStatus =
  "submitted" | "auto_checking" | "needs_review" | "approved" | "rejected" | "duplicate";

export type CheckOutcome = "pass" | "fail" | "flag" | "review";

export type AutoCheckResult = {
  id: string;
  label: string;
  outcome: CheckOutcome;
  detail: string;
};

export type RewardType = "approval" | "interview" | "hire" | "conversion";
export type EarningStatus = "held" | "released" | "paid" | "clawed_back";
export type PayoutStatus = "processing" | "paid";
export type PayoutMethodType = "bank" | "stripe";

export type ScoutAccount = {
  id: string;
  name: string;
  email: string;
  passwordText: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  acceptedTermsAt: string | null;
  verificationTier: VerificationTier;
  taxInfoComplete: boolean;
  payoutMethod: { type: PayoutMethodType; last4: string } | null;
  level: ScoutLevel;
  notifyDecisions: boolean;
  notifyRewards: boolean;
  createdAt: string;
};

export type Submission = {
  id: string;
  scoutUserId: string;
  jobId: string | null;
  url: string;
  canonicalUrl: string;
  companyName: string;
  title: string;
  locationText: string;
  salaryText: string;
  summary: string;
  tags: string[];
  seniority: Seniority;
  status: SubmissionStatus;
  rejectionReason: string;
  autoCheckResults: AutoCheckResult[];
  hiddenJob: boolean;
  alreadyOnMajorBoards: boolean;
  applications: number;
  interviews: number;
  hires: number;
  submittedAt: string;
  reviewedAt: string | null;
  expired: boolean;
};

export type Earning = {
  id: string;
  scoutUserId: string;
  submissionId: string | null;
  type: RewardType;
  amountCents: number;
  currency: string;
  status: EarningStatus;
  holdUntil: string;
  createdAt: string;
  releasedAt: string | null;
  paidAt: string | null;
  description: string;
};

export type ScoutNotification = {
  id: string;
  scoutUserId: string;
  title: string;
  description: string;
  href: string;
  unread: boolean;
  tone: NotificationTone;
  createdAt: string;
};

export type Payout = {
  id: string;
  scoutUserId: string;
  amountCents: number;
  currency: string;
  status: PayoutStatus;
  requestedAt: string;
  paidAt: string | null;
};

export type StoreState = {
  users: ScoutAccount[];
  activeUserId: string | null;
  submissions: Submission[];
  earnings: Earning[];
  notifications: ScoutNotification[];
  payouts: Payout[];
};

export type SubmitJobInput = {
  url: string;
  companyName: string;
  title: string;
  locationText: string;
  salaryText: string;
  summary: string;
  tags: string[];
  seniority: Seniority;
};

export type PrecheckResult = {
  url: string;
  canonicalUrl: string;
  reachable: boolean;
  official: boolean;
  duplicateOf: string | null;
  host: string;
  ats: boolean;
  jobBoard: boolean;
  reason: string;
};
