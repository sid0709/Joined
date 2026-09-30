export type BidderApplicationStatus =
  | "queued"
  | "claimed"
  | "preparing"
  | "needs_client_input"
  | "awaiting_client_approval"
  | "submitted"
  | "qa_passed"
  | "qa_failed"
  | "reassigned";

export type BidderLevel = "New" | "Rising" | "Top" | "Elite";
export type BidderCompensationModel = "piece_rate" | "marketplace";

export interface BidderClientRules {
  profileName: string;
  approvedResumeVersion: string;
  doNotApply: string[];
  savedAnswers: { question: string; answer: string }[];
  rules: string[];
}

export interface BidLogEntry {
  id: string;
  action:
    "opened" | "resume_uploaded" | "asked_client" | "submitted" | "evidence_captured" | "qa_failed";
  label: string;
  createdAt: string;
  detail?: string;
}

export interface BidderApplication {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  companyName: string;
  jobTitle: string;
  officialUrl: string;
  route: "Easy Apply" | "Company site" | "Referral";
  deadline: string;
  closingDate: string;
  status: BidderApplicationStatus;
  claimedAt?: string;
  claimExpiresAt?: string;
  rateText: string;
  locationText: string;
  assignedResumeSha256: string;
  skills: string[];
  summary: string;
  clientRules: BidderClientRules;
  checklist: { id: string; label: string; complete: boolean }[];
  bidLog: BidLogEntry[];
  evidenceFiles: string[];
  clientQuestions: string[];
  qaNote?: string;
  earningsText: string;
}

export interface BidderOnboardingState {
  identity: "not_started" | "in_review" | "verified";
  skillsTest: "not_started" | "in_progress" | "passed";
  taxInfo: "not_started" | "complete";
  terms: "not_started" | "accepted";
  rulesTraining: "not_started" | "in_progress" | "complete";
}

export interface BidderPerformanceSnapshot {
  level: BidderLevel;
  quota: number;
  quotaUsed: number;
  applicationsToday: number;
  interviewsThisWeek: number;
  qaPassRate: number;
  notRelevantRate: number;
  levelProgress: number;
}

export interface BidderEarningsSnapshot {
  pendingCents: number;
  heldCents: number;
  releasedCents: number;
  paidCents: number;
  perBidCents: number;
  perInterviewCents: number;
}
