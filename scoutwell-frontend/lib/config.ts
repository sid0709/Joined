export const BRAND = "Scoutwell";
export const CURRENCY = "USD";
export const LOCALE = "en-US";

/** Mock one-time codes for email and phone verification. */
export const MOCK_OTP = "000000";
export const OTP_LENGTH = 6;

export const HOLD_DAYS = 14;
export const MIN_PAYOUT_CENTS = 2500;
export const AUTO_CHECK_TIMEOUT_MS = 800;
export const SUMMARY_MIN_CHARS = 40;
export const SUMMARY_COPY_CHARS = 800;
export const DAILY_RESET_HOUR = 0;

export const DEMO_EMAIL = "maya@scoutwell.local";
export const DEMO_PASSWORD = "scoutwell";
export const DEMO_USER_ID = "scout-maya";

export const STORAGE_KEY = "scoutwell-store-v1";
export const STORAGE_EVENT = "scoutwell-store-change";

export const JOB_BOARD_HOSTS = [
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "monster.com",
  "simplyhired.com",
  "wellfound.com",
  "angel.co",
  "dice.com",
] as const;

export const ATS_HOST_SUFFIXES = [
  "boards.greenhouse.io",
  "jobs.lever.co",
  "jobs.ashbyhq.com",
  "jobs.smartrecruiters.com",
  "myworkdayjobs.com",
] as const;

export const SCAM_KEYWORDS = [
  "telegram",
  "whatsapp",
  "crypto",
  "bitcoin",
  "pay to apply",
  "application fee",
  "wire transfer",
] as const;

export type ScoutLevel = "probation" | "trusted" | "expert";
export type Seniority = "entry" | "mid" | "senior";

export const LEVEL_ORDER: ScoutLevel[] = ["probation", "trusted", "expert"];

export const LEVELS: Record<
  ScoutLevel,
  {
    label: string;
    dailyLimit: number;
    approvalRewardCents: number;
    interviewMultiplier: number;
    autoApprove: boolean;
  }
> = {
  probation: {
    label: "Probation",
    dailyLimit: 10,
    approvalRewardCents: 0,
    interviewMultiplier: 1,
    autoApprove: false,
  },
  trusted: {
    label: "Trusted",
    dailyLimit: 50,
    approvalRewardCents: 150,
    interviewMultiplier: 1,
    autoApprove: true,
  },
  expert: {
    label: "Expert",
    dailyLimit: 150,
    approvalRewardCents: 250,
    interviewMultiplier: 1.25,
    autoApprove: true,
  },
};

export const PROMOTION = {
  minApproved: 30,
  minApprovalRate: 0.9,
  maxDuplicateExpiredRate: 0.05,
  minInterviewProducingRate: 0.1,
} as const;

export const INTERVIEW_REWARD_CENTS: Record<Seniority, number> = {
  entry: 400,
  mid: 750,
  senior: 1500,
};

export const HIRE_REWARD_CENTS: Record<Seniority, number> = {
  entry: 2500,
  mid: 5000,
  senior: 10000,
};

export const CONVERSION_SHARE = 0.1;
export const MAJOR_BOARD_APPROVAL_DISCOUNT = 0.5;

export const SENIORITY_OPTIONS: { value: Seniority; label: string }[] = [
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
];

export const SUGGESTED_TAGS = ["remote", "hybrid", "visa", "hidden", "staff", "contract"] as const;
