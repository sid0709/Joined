import type {
  ApplicationStatus,
  Ats,
  BidderLevel,
  ChatMessage,
  HiringStage,
  InterviewMode,
  TaskType,
} from "@/src/shared/types/marketplace";

export type { ApplicationStatus, Ats, BidderLevel, ChatMessage, HiringStage, TaskType };

/** A job hunter who posts tasks to the board, as a bidder sees them. */
export interface BoardHunter {
  id: string;
  name: string;
  company: string;
  headline: string;
  rating: number;
  reviews: number;
  verified: boolean;
  replyTime: string;
  payoutSchedule: string;
  paidOnTimeRate: number;
  totalPaid: number;
  bidders: number;
  memberSince: string;
}

export interface BoardPackageLine {
  packageId: string;
  /** Links expected per week (permanent) or in total (one-time). */
  quota: number;
  rate: number;
}

export type BoardTaskStatus = "open" | "filling" | "closed";

export interface BoardTask {
  id: string;
  hunterId: string;
  title: string;
  type: TaskType;
  status: BoardTaskStatus;
  summary: string;
  description: string;
  requirements: string[];
  perks: string[];
  packageLines: BoardPackageLine[];
  dailyTarget: number;
  slots: number;
  slotsFilled: number;
  postedAt: string;
  startsAt: string;
  endsAt?: string;
  applicants: number;
  minLevel?: BidderLevel;
  /** Assessment a bidder must hold before the hunter will connect. */
  requiredAssessmentId?: string;
  qaBar: number;
  batchFile?: { name: string; linkCount: number };
}

export type EngagementStatus = "contacted" | "negotiating" | "connected" | "declined" | "withdrawn";

/** A bidder's conversation with a task owner. Every relationship starts as one of these. */
export interface Engagement {
  id: string;
  taskId: string;
  status: EngagementStatus;
  stage: HiringStage;
  pitch: string;
  proposedRates: { packageId: string; rate: number }[];
  weeklyCapacity: number;
  createdAt: string;
  unread: number;
  /** Count of hunter replies simulated so far, drives the mock negotiation. */
  replies: number;
  messages: ChatMessage[];
}

export interface Invitation {
  id: string;
  taskId: string;
  sentAt: string;
  expiresAt: string;
  message: string;
  offeredRate: number;
  status: "pending" | "accepted" | "declined";
}

export interface BidderInterview {
  id: string;
  engagementId: string;
  date: string;
  start: string;
  durationMin: number;
  mode: InterviewMode;
  status: "scheduled" | "completed" | "cancelled";
  link?: string;
  agenda: string[];
  outcome?: string;
}

export type AssignmentStatus = "active" | "completed" | "paused";

export interface BidderAssignment {
  id: string;
  engagementId: string;
  taskId: string;
  packageId: string;
  rate: number;
  jobIds: string[];
  assignedAt: string;
  dueAt: string;
  dailyTarget: number;
  status: AssignmentStatus;
  note: string;
}

export interface BidderApplication {
  id: string;
  assignmentId: string;
  taskId: string;
  packageId: string;
  jobId: string;
  bidderId: string;
  status: ApplicationStatus;
  updatedAt: string;
  minutesSpent?: number;
  confirmation?: string;
  evidenceNote?: string;
  issue?: string;
}

export type ReviewVerdict = "approved" | "mistake" | "warning" | "praise";
export type ReviewResolution = "open" | "acknowledged" | "fixed" | "disputed" | "closed";

export interface ReviewComment {
  id: string;
  sender: "hunter" | "bidder";
  body: string;
  at: string;
}

/** The job hunter's judgment of one piece of work, plus the conversation about it. */
export interface Review {
  id: string;
  taskId: string;
  assignmentId?: string;
  applicationId?: string;
  verdict: ReviewVerdict;
  resolution: ReviewResolution;
  rating: number;
  summary: string;
  detail: string;
  tags: string[];
  at: string;
  thread: ReviewComment[];
}

export type PayoutStatus = "pending" | "processing" | "paid";

export interface Payout {
  id: string;
  hunterId: string;
  period: string;
  links: number;
  gross: number;
  fee: number;
  status: PayoutStatus;
  issuedAt: string;
  paidAt?: string;
  method: string;
}

export interface WalletTransaction {
  id: string;
  kind: "payout" | "withdrawal" | "bonus" | "adjustment";
  label: string;
  amount: number;
  at: string;
}

export interface RateLevel {
  level: BidderLevel | "New";
  minQa: number;
  minLinks: number;
  multiplier: string;
  perks: string[];
}

export interface Assessment {
  id: string;
  title: string;
  ats: Ats | "General";
  minutes: number;
  questions: number;
  passMark: number;
  unlocks: string;
  status: "available" | "passed" | "failed";
  score?: number;
  takenAt?: string;
}

export type BidderNotificationKind =
  "invitation" | "message" | "review" | "payout" | "work" | "system";

export interface BidderNotification {
  id: string;
  kind: BidderNotificationKind;
  title: string;
  body: string;
  at: string;
  read: boolean;
  href: string;
}

export interface BidderProfile {
  name: string;
  handle: string;
  headline: string;
  bio: string;
  level: BidderLevel;
  timezone: string;
  languages: string[];
  specialties: Ats[];
  workingDays: number[];
  weeklyCapacity: number;
  minRates: Partial<Record<Ats, number>>;
  email: string;
  payoutMethod: string;
  autoPayout: boolean;
  openToNewTasks: boolean;
  joinedAt: string;
  verifications: { id: string; label: string; done: boolean }[];
  notifications: { invitations: boolean; messages: boolean; reviews: boolean; payouts: boolean };
}
