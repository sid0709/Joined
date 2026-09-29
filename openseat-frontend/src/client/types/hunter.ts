export type Ats = "Greenhouse" | "Lever" | "Ashby" | "Workday" | "iCIMS" | "SmartRecruiters";
export type Difficulty = "Easy" | "Standard" | "Advanced";
export type BidderLevel = "Rising" | "Top" | "Elite";

/** A job application link in the admin-managed pool. Job hunters never edit the pool. */
export interface PoolJob {
  id: string;
  company: string;
  title: string;
  ats: Ats;
  location: string;
  workplace: "Remote" | "Hybrid" | "On-site";
  seniority: "Mid" | "Senior" | "Lead" | "Director";
  function: string;
  salary: string;
  postedDaysAgo: number;
  applyUrl: string;
}

/** A rate card: the price a job hunter pays per submitted link, keyed to how hard the ATS is. */
export interface PackageTier {
  id: string;
  name: string;
  ats: Ats[];
  difficulty: Difficulty;
  ratePerLink: number;
  minutesPerLink: number;
  turnaround: string;
  description: string;
}

export type TaskType = "permanent" | "one_time";
export type TaskStatus = "draft" | "open" | "in_progress" | "paused" | "completed";

export interface TaskPackageLine {
  packageId: string;
  /** Links the job hunter expects to send per week (permanent) or in total (one-time). */
  quota: number;
  /** Rate agreed for this task; starts from the package rate card. */
  rate: number;
}

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  summary: string;
  requirements: string[];
  packageLines: TaskPackageLine[];
  dailyTarget: number;
  bidderSlots: number;
  budgetCap: number;
  postedAt: string;
  startsAt: string;
  endsAt?: string;
  views: number;
  /** One-time tasks ship as a zipped batch of links. */
  batchFile?: { name: string; sizeKb: number; linkCount: number };
}

export interface Bidder {
  id: string;
  name: string;
  initials: string;
  level: BidderLevel;
  headline: string;
  timezone: string;
  languages: string[];
  specialties: Ats[];
  rating: number;
  reviews: number;
  completedLinks: number;
  qaPassRate: number;
  avgMinutesPerLink: number;
  replyTime: string;
  joinedAt: string;
  /** Contact details appear only after the job hunter accepts the inquiry. */
  email: string;
  handle: string;
}

export type InquiryStatus = "new" | "negotiating" | "connected" | "declined";

/** Where a bidder sits in the job hunter's hiring process for one task. */
export type HiringStage =
  "inquiry" | "screening" | "interview" | "trial" | "connected" | "declined";

export interface ChatMessage {
  id: string;
  sender: "hunter" | "bidder" | "system";
  body: string;
  at: string;
}

/** A bidder contacting the task owner from the task board. This is how every bidder relationship starts. */
export interface Inquiry {
  id: string;
  taskId: string;
  bidderId: string;
  status: InquiryStatus;
  stage: HiringStage;
  /** The job hunter's private notes about this bidder. */
  notes: string;
  /** The job hunter's private score after screening or interviews, 1-5. */
  score?: number;
  createdAt: string;
  proposedRates: { packageId: string; rate: number }[];
  weeklyCapacity: number;
  pitch: string;
  unread: number;
  messages: ChatMessage[];
}

export type InterviewMode = "video" | "phone" | "chat";
export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type InterviewOutcome = "advance" | "hold" | "reject";

export interface Interview {
  id: string;
  inquiryId: string;
  /** Calendar day in the job hunter's timezone, YYYY-MM-DD. */
  date: string;
  /** 24-hour HH:mm in the job hunter's timezone. */
  start: string;
  durationMin: number;
  mode: InterviewMode;
  status: InterviewStatus;
  link?: string;
  notes: string;
  outcome?: InterviewOutcome;
  score?: number;
}

export type AssignmentStatus = "active" | "completed" | "paused";

export interface Assignment {
  id: string;
  taskId: string;
  bidderId: string;
  packageId: string;
  jobIds: string[];
  assignedAt: string;
  dueAt: string;
  status: AssignmentStatus;
  note: string;
}

export type ApplicationStatus =
  "queued" | "in_progress" | "submitted" | "qa_passed" | "returned" | "failed";

export interface ApplicationRecord {
  id: string;
  assignmentId: string;
  jobId: string;
  bidderId: string;
  packageId: string;
  taskId: string;
  status: ApplicationStatus;
  updatedAt: string;
  minutesSpent?: number;
  issue?: string;
}

export interface DailyPoint {
  date: string;
  submitted: number;
  qaPassed: number;
  target: number;
}

export interface Feedback {
  id: string;
  bidderId: string;
  assignmentId?: string;
  rating: number;
  message: string;
  at: string;
  tags: string[];
}

export type InvoiceStatus = "open" | "paid" | "overdue";

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  assignmentId: string;
  taskId: string;
  bidderId: string;
  packageId: string;
  links: number;
  rate: number;
}

export interface Invoice {
  id: string;
  number: string;
  period: string;
  issuedAt: string;
  dueAt: string;
  status: InvoiceStatus;
  paidAt?: string;
}

export interface Transaction {
  id: string;
  kind: "deposit" | "payout" | "refund";
  label: string;
  amount: number;
  at: string;
}

export type NotificationKind = "inquiry" | "message" | "qa" | "billing" | "task" | "system";

export interface HunterNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string;
  read: boolean;
  href: string;
}

export interface InterviewAvailability {
  /** 0 = Sunday. */
  days: number[];
  startHour: number;
  endHour: number;
  defaultDurationMin: number;
  bufferMin: number;
  timezone: string;
  meetingLink: string;
}

export interface NotificationPreferences {
  inquiries: boolean;
  interviews: boolean;
  qa: boolean;
  billing: boolean;
  weeklyDigest: boolean;
}

export interface HunterProfile {
  name: string;
  company: string;
  headline: string;
  website: string;
  balance: number;
  autoTopUp: boolean;
  availability: InterviewAvailability;
  notifications: NotificationPreferences;
}
