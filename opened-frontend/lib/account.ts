export type MailMessage = {
  id: string;
  from: "them" | "you";
  text: string;
  time: string;
};

export type MailThread = {
  id: string;
  title: string;
  preview: string;
  messages: MailMessage[];
};

export type CompanyJobStatus = "Open" | "Paused" | "Closed";

export type CompanyJob = {
  id: string;
  title: string;
  location: string;
  applicants: number;
  status: CompanyJobStatus;
  policy: string;
};

export type Applicant = {
  id: string;
  name: string;
  role: string;
  jobTitle: string;
  fit: number;
  verified: boolean;
  assisted: "No" | "Bidder" | "AI-prepared";
  resume: string;
};

export type TeamMember = {
  name: string;
  role: "Owner" | "Admin" | "Recruiter" | "Viewer";
};

export const UNREAD_MESSAGES = 2;

export const THREADS: MailThread[] = [
  {
    id: "northwind",
    title: "Northwind",
    preview: "Tuesday at 10:00 still works.",
    messages: [
      {
        id: "n1",
        from: "them",
        text: "Thanks for applying. Are you free Tuesday at 10:00 for a video round?",
        time: "Mon 9:12",
      },
      { id: "n2", from: "you", text: "Yes, Tuesday at 10:00 works.", time: "Mon 9:40" },
      {
        id: "n3",
        from: "them",
        text: "Tuesday at 10:00 still works. The invite is on its way.",
        time: "Mon 11:02",
      },
    ],
  },
  {
    id: "harbor",
    title: "Harbor",
    preview: "We saw your application.",
    messages: [
      {
        id: "h1",
        from: "them",
        text: "We saw your application for Frontend Engineer. A recruiter will write if there is a fit.",
        time: "Sun 16:20",
      },
    ],
  },
  {
    id: "system",
    title: "Opened",
    preview: "Your default resume was parsed.",
    messages: [
      {
        id: "s1",
        from: "them",
        text: "Your default resume was parsed. Review the headline on your profile before you apply to direct jobs.",
        time: "Sat 8:00",
      },
    ],
  },
];

export const COMPANY_JOBS: CompanyJob[] = [
  {
    id: "cj-1",
    title: "Product Designer",
    location: "Chicago · Hybrid",
    applicants: 18,
    status: "Open",
    policy: "Assisted allowed",
  },
  {
    id: "cj-2",
    title: "Data Analyst",
    location: "New York · Hybrid",
    applicants: 9,
    status: "Open",
    policy: "Cap 5 / day",
  },
  {
    id: "cj-3",
    title: "Support Lead",
    location: "Remote",
    applicants: 4,
    status: "Paused",
    policy: "Direct only",
  },
  {
    id: "cj-4",
    title: "Office Coordinator",
    location: "Chicago · On-site",
    applicants: 22,
    status: "Closed",
    policy: "Direct only",
  },
];

export const APPLICANTS: Applicant[] = [
  {
    id: "a-1",
    name: "Alex Rivera",
    role: "Product designer",
    jobTitle: "Product Designer",
    fit: 91,
    verified: true,
    assisted: "No",
    resume: "General",
  },
  {
    id: "a-2",
    name: "Dana Kim",
    role: "Product designer",
    jobTitle: "Product Designer",
    fit: 84,
    verified: true,
    assisted: "AI-prepared",
    resume: "Design-focused",
  },
  {
    id: "a-3",
    name: "Riley Chen",
    role: "Analyst",
    jobTitle: "Data Analyst",
    fit: 77,
    verified: true,
    assisted: "Bidder",
    resume: "General",
  },
  {
    id: "a-4",
    name: "Sam Okafor",
    role: "Support",
    jobTitle: "Support Lead",
    fit: 69,
    verified: false,
    assisted: "No",
    resume: "General",
  },
];

export const TEAM: TeamMember[] = [
  { name: "Alex Rivera", role: "Owner" },
  { name: "Dana Kim", role: "Recruiter" },
  { name: "Riley Chen", role: "Viewer" },
];

/** Integer cents. Display only after formatting. */
export const BILLING = {
  plan: "Free",
  spendCents: 0,
  capCents: 200_000,
  freeInterviewsRemaining: 10,
  currency: "USD",
} as const;

export function formatCents(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export const INITIAL_SAVED_JOB_IDS = ["support-lead-harbor"];
