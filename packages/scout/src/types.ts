/**
 * The scout API contract (backend-core/scout, served by scoutwell-backend). Field names are the
 * snake_case JSON the API sends; see docs/61-scout-api.md.
 * Workplace, seniority, employment, and pay use @joined/job-schema.
 */

import type { Employment, Pay, PayPeriod, Seniority, Workplace } from "@joined/job-schema";

export type { Employment, Pay, PayPeriod, Seniority, Workplace };

export type Money = { amount_cents: number; currency: string };

export type SubmissionStatus =
  "submitted" | "auto_checking" | "needs_review" | "approved" | "rejected" | "duplicate";
export type CheckOutcome = "pass" | "fail" | "review" | "flag";
export type ScoutLevel = "probation" | "trusted" | "expert";
export type Channel = "web" | "api";
export type Verification = "none" | "pending" | "verified" | "rejected";
export type EarningStatus = "held" | "released" | "processing" | "paid" | "clawed_back";
export type RewardType = "approval" | "apply" | "interview" | "hire" | "conversion";
export type PayoutStatus = "requested" | "paid" | "rejected";
export type NotificationTone = "accent" | "success" | "warning" | "danger" | "neutral";
export type NotificationKind = "decision" | "reward" | "level" | "payout" | "verification";

export type Check = { id: string; label: string; outcome: CheckOutcome; detail: string };

export type JobActivity = { applications: number; interviews: number };

export type SubmissionInput = {
  url: string;
  company_name: string;
  company_id?: string;
  title: string;
  location_text: string;
  workplace?: Workplace | "";
  employment?: Employment | "";
  seniority?: Seniority | "";
  pay?: Pay;
  equity: boolean;
  salary: string;
  summary: string;
  not_duplicate_claim?: boolean;
  external_ref?: string;
};

export type ExtensionSubmissionInput = {
  title: string;
  company: string;
  location: string;
  apply_url: string;
  description: string;
  board?: string;
};

export type ExtensionSubmissionResponse = {
  submission: Submission;
};

export type Submission = {
  id: string;
  scout_user_id: string;
  channel: Channel;
  api_key_id?: string;
  external_ref?: string;
  url: string;
  canonical_url: string;
  final_url?: string;
  host: string;
  ats?: string;
  company_name: string;
  company_id?: string;
  title: string;
  location_text: string;
  workplace: Workplace;
  employment: Employment;
  seniority: Seniority;
  pay: Pay;
  equity: boolean;
  salary: string;
  summary: string;
  status: SubmissionStatus;
  rejection_code?: string;
  rejection_reason?: string;
  auto_check_results: Check[];
  duplicate_of?: string;
  duplicate_claim?: boolean;
  matches?: JobMatch[];
  hidden_job: boolean;
  spot_check?: boolean;
  job_id?: string;
  temp_job_id?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_note?: string;
  expired: boolean;
  expired_at?: string;
  settled_interviews: number;
  hires: number;
  activity: JobActivity;
  submitted_at: string;
  checked_at?: string;
  updated_at: string;
};

export type TaxInfo = {
  legal_name: string;
  country: string;
  tax_id_last4: string;
  completed_at: string;
};

export type PayoutMethodType = "bank" | "paypal";

export type PayoutMethod = {
  type: PayoutMethodType;
  label: string;
  last4: string;
  updated_at: string;
};

export type Profile = {
  user_id: string;
  name: string;
  email: string;
  level: ScoutLevel;
  level_pinned: boolean;
  terms_accepted_at: string | null;
  verification: Verification;
  verification_note?: string;
  legal_name?: string;
  country?: string;
  tax_info: TaxInfo | null;
  payout_method: PayoutMethod | null;
  notify_decisions: boolean;
  notify_rewards: boolean;
  verification_tier: 0 | 1 | 2;
  created_at: string;
  updated_at: string;
  verification_updated_at?: string;
};

export type ProfilePatch = {
  name?: string;
  notify_decisions?: boolean;
  notify_rewards?: boolean;
};

export type Earning = {
  id: string;
  scout_user_id: string;
  submission_id?: string;
  job_title?: string;
  company_name?: string;
  type: RewardType;
  amount: Money;
  status: EarningStatus;
  description: string;
  hold_until: string;
  payout_id?: string;
  created_at: string;
  released_at?: string;
  paid_at?: string;
};

export type Payout = {
  id: string;
  scout_user_id: string;
  scout_name?: string;
  scout_email?: string;
  amount: Money;
  method: PayoutMethod;
  earning_ids: string[];
  status: PayoutStatus;
  note?: string;
  requested_at: string;
  decided_at?: string;
};

export type ScoutNotification = {
  id: string;
  kind: NotificationKind;
  tone: NotificationTone;
  title: string;
  body: string;
  subject_id?: string;
  read: boolean;
  created_at: string;
};

/** Cursor pagination: pass `next_cursor` back as `cursor` until it is empty. */
export type List<T> = { data: T[]; next_cursor: string };

/** Offset pagination used by the admin console tables. */
export type AdminList<T> = { data: T[]; total: number; page: number; page_size: number };

export type LevelRule = {
  id: ScoutLevel;
  label: string;
  daily_limit: number;
  auto_approve: boolean;
  spot_check_rate: number;
  approval_reward: Money;
  interview_multiplier: number;
};

export type PromotionRule = {
  min_approved: number;
  min_approval_rate: number;
  max_duplicate_expired_rate: number;
  min_interview_producing_rate: number;
  demote_below_approval_rate: number;
  demote_min_decided: number;
};

export type RewardTable = {
  hold_days: number;
  min_payout: Money;
  apply_reward: Money;
  interview_by_seniority: Record<Seniority, Money>;
  hire_by_seniority: Record<Seniority, Money>;
  conversion_share: number;
};

export type Limits = {
  min_summary_chars: number;
  max_summary_chars: number;
  max_batch: number;
  workplaces: Workplace[];
  employments: Employment[];
  seniorities: Seniority[];
};

export type Reason = { code: string; label: string };

/** The public rulebook: GET /v1/scout/meta. */
export type Meta = {
  levels: LevelRule[];
  promotion: PromotionRule;
  rewards: RewardTable;
  limits: Limits;
  rejection_reasons: Reason[];
};

export type Metrics = {
  submitted: number;
  pending: number;
  approved: number;
  rejected: number;
  duplicate: number;
  expired: number;
  live: number;
  with_interview: number;
  approval_rate: number;
  duplicate_expired_rate: number;
  interview_producing_rate: number;
  submitted_today: number;
  daily_limit: number;
  remaining_today: number;
  resets_at: string;
};

export type Balance = {
  held: Money;
  released: Money;
  processing: Money;
  paid: Money;
  clawed_back: Money;
  lifetime: Money;
};

export type EarningsSummary = {
  by_type: Partial<Record<RewardType, Money>>;
  total: Money;
};

export type PayoutReadiness = { ready: boolean; blockers: string[] };

export type Quota = { limit: number; remaining: number; resets_at: string };

/** GET /v1/scout/stats. */
export type Stats = {
  profile: Profile;
  level: LevelRule;
  next_level: LevelRule | null;
  promotion: PromotionRule;
  metrics: Metrics;
  balance: Balance;
  payout: PayoutReadiness;
  quota: Quota;
  unread_notifications: number;
  /** Candidate usage summed over the scout's live jobs. */
  activity: JobActivity;
};

export type Precheck = {
  url: string;
  canonical_url: string;
  host: string;
  ats?: string;
  reachable: boolean;
  http_status?: number;
  official: boolean;
  still_open: boolean | null;
  reason: string;
};

export type MatchKind = "link" | "company_title";

export type JobMatch = {
  kind: MatchKind;
  job_id?: string;
  submission_id?: string;
  title: string;
  company: string;
  apply_link: string;
};

export type MatchResult = { matches: JobMatch[] };

export type MatchCompare = {
  match: JobMatch;
  same_position: boolean;
  reason: string;
};

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

/** Returned once, on creation: the only time the secret is visible. */
export type CreatedApiKey = ApiKey & { secret: string };

export type FieldError = { field: string; detail: string };

export type BatchResult = {
  index: number;
  submission?: Submission;
  error?: { code: string; detail: string; errors?: FieldError[]; existing_id?: string };
};

// Admin console.

export type ScoutBrief = {
  user_id: string;
  name: string;
  email: string;
  level: ScoutLevel;
  verification: Verification;
};

export type AdminSubmission = Submission & { scout: ScoutBrief };

export type ScoutSummary = { profile: Profile; metrics: Metrics; balance: Balance };

export type AuditEntry = {
  action: string;
  subject_type: string;
  subject_id: string;
  actor: string;
  note?: string;
  at: string;
};

export type AdminSubmissionDetail = {
  submission: Submission;
  scout: ScoutSummary;
  duplicate_of_submission?: Submission;
  earnings: Earning[];
  audit: AuditEntry[];
  rejection_reasons: Reason[];
  related: Submission[];
  scout_recent: Submission[];
  level_rule: LevelRule;
  queue: { next_id?: string };
};

export type AdminScoutDetail = ScoutSummary & {
  submissions: Submission[];
  payouts: Payout[];
  audit: AuditEntry[];
};

export type Overview = {
  needs_review: number;
  checking: number;
  oldest_review_at: string | null;
  submitted_today: number;
  approved_today: number;
  rejected_today: number;
  live_jobs: number;
  scouts: number;
  pending_verifications: number;
  pending_payouts: number;
  pending_payout_amount: Money;
  api_submitted_today: number;
};

export type ReviewDecision = "approve" | "reject" | "duplicate";

export type ReviewInput = {
  decision: ReviewDecision;
  reason_code?: string;
  note?: string;
  duplicate_of?: string;
  edits?: SubmissionInput;
};

export type ScoutPatch = {
  level?: ScoutLevel;
  level_pinned?: boolean;
  verification?: "verified" | "rejected";
  note?: string;
};

export type PayoutDecision = { decision: "paid" | "rejected"; note?: string };
