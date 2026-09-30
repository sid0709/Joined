import type {
  Assessment,
  BidderNotification,
  BidderProfile,
  RateLevel,
  WalletTransaction,
} from "@/src/candidate/types/workspace";

import { isoAgo } from "@/src/shared/mock/clock";

export const INITIAL_PROFILE: BidderProfile = {
  name: "Alex Morgan",
  handle: "@alex.applies",
  headline: "Detail-first bidder for startup, operations and Workday applications",
  bio: "Two and a half years of ATS work across Greenhouse, Lever, Ashby and Workday. I keep a personal answer bank, verify every link and screenshot every confirmation page. I flag blockers the same day so hunters never wait on me.",
  level: "Rising",
  timezone: "EST · UTC−5",
  languages: ["English", "Spanish"],
  specialties: ["Greenhouse", "Lever", "Ashby", "Workday"],
  workingDays: [1, 2, 3, 4, 5],
  weeklyCapacity: 120,
  minRates: { Greenhouse: 0.7, Lever: 1.2, Ashby: 1.2, Workday: 1.35 },
  email: "alex.morgan@bidmail.io",
  payoutMethod: "Bank transfer · Chase ending 6620",
  autoPayout: true,
  openToNewTasks: true,
  joinedAt: "2025-04-08T00:00:00Z",
  verifications: [
    { id: "identity", label: "Identity verified", done: true },
    { id: "email", label: "Email confirmed", done: true },
    { id: "payout", label: "Payout method added", done: true },
    { id: "training", label: "Rules training completed", done: true },
    { id: "assessment", label: "Pass one ATS assessment", done: true },
    { id: "video", label: "Intro video (optional)", done: false },
  ],
  notifications: { invitations: true, messages: true, reviews: true, payouts: true },
};

/** How rates and trust grow with verified quality. */
export const RATE_LEVELS: RateLevel[] = [
  {
    level: "New",
    minQa: 0,
    minLinks: 0,
    multiplier: "Board rate",
    perks: ["Access to Easy and Standard packages"],
  },
  {
    level: "Rising",
    minQa: 90,
    minLinks: 150,
    multiplier: "Board rate +0%",
    perks: ["Apply to permanent desks", "Weekly payouts", "Early payout requests"],
  },
  {
    level: "Top",
    minQa: 94,
    minLinks: 600,
    multiplier: "Board rate +8%",
    perks: ["Priority in hunter searches", "Advanced packages", "Rate bonus on every link"],
  },
  {
    level: "Elite",
    minQa: 96,
    minLinks: 1200,
    multiplier: "Board rate +15%",
    perks: ["Invitation-only desks", "Same-day payouts", "Dedicated support"],
  },
];

export interface QuizQuestion {
  prompt: string;
  options: string[];
  answer: number;
}

export const ASSESSMENT_QUIZ: Record<string, QuizQuestion[]> = {
  "assess-greenhouse": [
    {
      prompt:
        "A Greenhouse form asks for expected salary but the hunter's guide is silent. What do you do?",
      options: [
        "Enter a market rate you believe is fair",
        "Ask the hunter in chat before submitting",
        "Leave the field blank and submit",
      ],
      answer: 1,
    },
    {
      prompt: "What proof must accompany every submission?",
      options: [
        "A confirmation page screenshot",
        "The job description PDF",
        "Nothing, the ATS emails it",
      ],
      answer: 0,
    },
    {
      prompt: "You spot the same company twice in one batch. Best action?",
      options: [
        "Apply to both to be safe",
        "Skip the second and note it for the hunter",
        "Delete the second link",
      ],
      answer: 1,
    },
  ],
  "assess-workday": [
    {
      prompt: "Workday parses the resume and puts the job title in the employer field. You should…",
      options: [
        "Submit anyway, the parser is usually right",
        "Correct every parsed section before continuing",
        "Upload a different resume",
      ],
      answer: 1,
    },
    {
      prompt: "Where do employer account credentials belong?",
      options: ["The shared vault", "A personal notes app", "A chat message to the hunter"],
      answer: 0,
    },
    {
      prompt: "A Workday page times out after you've filled three sections. Best next step?",
      options: [
        "Restart and re-enter everything without checking",
        "Log back in and review the saved draft before resubmitting",
        "Abandon the link and mark it failed",
      ],
      answer: 1,
    },
  ],
  "assess-icims": [
    {
      prompt: "An iCIMS eligibility question is unclear. What is the correct behaviour?",
      options: [
        "Choose the safest looking option",
        "Escalate to the hunter and wait for a written answer",
        "Copy the answer from a previous application",
      ],
      answer: 1,
    },
    {
      prompt: "References are required but the hunter has supplied only two of three. You should…",
      options: [
        "Invent a third reference",
        "Submit with two and hope it passes",
        "Ask the hunter for the third before submitting",
      ],
      answer: 2,
    },
    {
      prompt: "How long should you budget per iCIMS link?",
      options: ["About 5 minutes", "About 20 minutes", "About 60 minutes"],
      answer: 1,
    },
  ],
  "assess-standards": [
    {
      prompt:
        "A hunter asks you to answer a work-authorization question in a way you know is untrue. You…",
      options: [
        "Follow the hunter, it's their client",
        "Decline and report it to OpenSeat support",
        "Answer differently without telling anyone",
      ],
      answer: 1,
    },
    {
      prompt: "Client resumes and answer banks are…",
      options: [
        "Shareable with other bidders",
        "Confidential and used only for the assigned task",
        "Fine to keep after the task ends",
      ],
      answer: 1,
    },
    {
      prompt: "What is the fastest way to get an application returned for a fix approved?",
      options: [
        "Resubmit without a note",
        "Fix it, add a fresh screenshot and reply in Reviews",
        "Ask another bidder to redo it",
      ],
      answer: 1,
    },
  ],
};

export const INITIAL_ASSESSMENTS: Assessment[] = [
  {
    id: "assess-standards",
    title: "OpenSeat work standards",
    ats: "General",
    minutes: 10,
    questions: 3,
    passMark: 67,
    unlocks: "Required for every desk",
    status: "passed",
    score: 100,
    takenAt: isoAgo(170),
  },
  {
    id: "assess-greenhouse",
    title: "Greenhouse fundamentals",
    ats: "Greenhouse",
    minutes: 12,
    questions: 3,
    passMark: 67,
    unlocks: "Easy packages at the board rate",
    status: "passed",
    score: 100,
    takenAt: isoAgo(160),
  },
  {
    id: "assess-workday",
    title: "Workday professional",
    ats: "Workday",
    minutes: 20,
    questions: 3,
    passMark: 67,
    unlocks: "Workday packages and senior batches",
    status: "passed",
    score: 67,
    takenAt: isoAgo(75),
  },
  {
    id: "assess-icims",
    title: "iCIMS specialist",
    ats: "iCIMS",
    minutes: 25,
    questions: 3,
    passMark: 67,
    unlocks: "Advanced packages and healthcare launch batches",
    status: "available",
  },
];

export const INITIAL_NOTIFICATIONS: BidderNotification[] = [
  {
    id: "bn-1",
    kind: "invitation",
    title: "Lumen Health Careers invited you",
    body: "Lena Fischer invited you to the Healthcare operations launch batch at $2.15 per link.",
    at: isoAgo(0, 6),
    read: false,
    href: "/marketplace/candidate/invitations",
  },
  {
    id: "bn-2",
    kind: "review",
    title: "Two Workday links were returned",
    body: "Marcus Bell returned two applications for resume parsing errors. Fix and resubmit to keep your QA rate.",
    at: isoAgo(0, 6),
    read: false,
    href: "/marketplace/candidate/feedback",
  },
  {
    id: "bn-3",
    kind: "message",
    title: "Avery Morgan replied",
    body: "Hi Alex, thanks for reaching out. Can you tell me how you handle the free-text questions?",
    at: isoAgo(0, 3),
    read: false,
    href: "/marketplace/messages?thread=eng-gh",
  },
  {
    id: "bn-4",
    kind: "work",
    title: "Interview tomorrow at 3:00 PM",
    body: "Priya Nair scheduled a 30 minute video call about the senior technical batch.",
    at: isoAgo(1, 19),
    read: false,
    href: "/marketplace/candidate/calendar",
  },
  {
    id: "bn-5",
    kind: "invitation",
    title: "Northstar invited you to the iCIMS desk",
    body: "Priya Nair offered $2.05 per link, weekly payout. The invitation expires in 5 days.",
    at: isoAgo(1),
    read: true,
    href: "/marketplace/candidate/invitations",
  },
  {
    id: "bn-6",
    kind: "payout",
    title: "Weekly payout sent",
    body: "Your payout for the week of Sep 14 was sent to Chase ending 6620.",
    at: isoAgo(3, 2),
    read: true,
    href: "/marketplace/candidate/earnings",
  },
  {
    id: "bn-7",
    kind: "review",
    title: "New praise from Grace Liu",
    body: "Excellent week on the operations desk. Twenty-four links in one day with no blockers.",
    at: isoAgo(2, 4),
    read: true,
    href: "/marketplace/candidate/feedback",
  },
  {
    id: "bn-8",
    kind: "system",
    title: "Your QA rate is above 92%",
    body: "Your rolling QA pass rate is holding steady. Reach 94% and 600 approved links to unlock Top level.",
    at: isoAgo(5),
    read: true,
    href: "/marketplace/candidate/performance",
  },
];

export const SEED_TRANSACTIONS: WalletTransaction[] = [
  {
    id: "wt-bonus",
    kind: "bonus",
    label: "Weekly QA bonus · Avery Morgan",
    amount: 15,
    at: isoAgo(17),
  },
  {
    id: "wt-wd",
    kind: "withdrawal",
    label: "Early payout to Chase ending 6620",
    amount: -40,
    at: isoAgo(11),
  },
];
