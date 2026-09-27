export type ApplicationStatus = "Saved" | "Applied" | "Viewed" | "Interview" | "Offer" | "Rejected" | "No response";

export type ApplicationRow = {
  id: string;
  jobId: string;
  title: string;
  company: string;
  status: ApplicationStatus;
  updated: string;
};

export type InterviewItem = {
  id: string;
  title: string;
  time: string;
  description: string;
  group: "Upcoming" | "Past";
  status: "current" | "upcoming" | "done";
};

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

export type ResumeVersion = {
  id: string;
  label: string;
  updated: string;
  isDefault: boolean;
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

export const APPLICATIONS: ApplicationRow[] = [
  { id: "app-1", jobId: "product-designer-northwind", title: "Product Designer", company: "Northwind", status: "Interview", updated: "Today" },
  { id: "app-2", jobId: "frontend-engineer-harbor", title: "Frontend Engineer", company: "Harbor", status: "Viewed", updated: "Yesterday" },
  { id: "app-3", jobId: "data-analyst-northwind", title: "Data Analyst", company: "Northwind", status: "Applied", updated: "Mon" },
  { id: "app-4", jobId: "support-lead-harbor", title: "Support Lead", company: "Harbor", status: "Saved", updated: "Sun" },
  { id: "app-5", jobId: "recruiter-lumen", title: "Technical Recruiter", company: "Lumen Health", status: "No response", updated: "Sep 12" },
  { id: "app-6", jobId: "content-designer-fieldnote", title: "Content Designer", company: "Fieldnote", status: "Rejected", updated: "Sep 4" },
];

export const INTERVIEWS: InterviewItem[] = [
  {
    id: "int-1",
    title: "Product Designer · Northwind",
    time: "Tue · 10:00",
    description: "Round 1 · Video · Confirm if the calendar invite is right.",
    group: "Upcoming",
    status: "current",
  },
  {
    id: "int-2",
    title: "Frontend Engineer · Harbor",
    time: "Thu · 14:30",
    description: "Round 1 · Detected from email. Mark it if this is not an interview.",
    group: "Upcoming",
    status: "upcoming",
  },
  {
    id: "int-3",
    title: "Content Designer · Fieldnote",
    time: "Sep 4",
    description: "Round 2 · Completed. No offer followed.",
    group: "Past",
    status: "done",
  },
];

export const UNREAD_MESSAGES = 2;

export const THREADS: MailThread[] = [
  {
    id: "northwind",
    title: "Northwind",
    preview: "Tuesday at 10:00 still works.",
    messages: [
      { id: "n1", from: "them", text: "Thanks for applying. Are you free Tuesday at 10:00 for a video round?", time: "Mon 9:12" },
      { id: "n2", from: "you", text: "Yes, Tuesday at 10:00 works.", time: "Mon 9:40" },
      { id: "n3", from: "them", text: "Tuesday at 10:00 still works. The invite is on its way.", time: "Mon 11:02" },
    ],
  },
  {
    id: "harbor",
    title: "Harbor",
    preview: "We saw your application.",
    messages: [
      { id: "h1", from: "them", text: "We saw your application for Frontend Engineer. A recruiter will write if there is a fit.", time: "Sun 16:20" },
    ],
  },
  {
    id: "system",
    title: "Opened",
    preview: "Your default resume was parsed.",
    messages: [
      { id: "s1", from: "them", text: "Your default resume was parsed. Review the headline on your profile before you apply to direct jobs.", time: "Sat 8:00" },
    ],
  },
];

export const RESUMES: ResumeVersion[] = [
  { id: "resume-general", label: "General", updated: "Sep 18", isDefault: true },
  { id: "resume-design", label: "Design-focused", updated: "Aug 2", isDefault: false },
];

export const COMPANY_JOBS: CompanyJob[] = [
  { id: "cj-1", title: "Product Designer", location: "Chicago · Hybrid", applicants: 18, status: "Open", policy: "Assisted allowed" },
  { id: "cj-2", title: "Data Analyst", location: "New York · Hybrid", applicants: 9, status: "Open", policy: "Cap 5 / day" },
  { id: "cj-3", title: "Support Lead", location: "Remote", applicants: 4, status: "Paused", policy: "Direct only" },
  { id: "cj-4", title: "Office Coordinator", location: "Chicago · On-site", applicants: 22, status: "Closed", policy: "Direct only" },
];

export const APPLICANTS: Applicant[] = [
  { id: "a-1", name: "Alex Rivera", role: "Product designer", jobTitle: "Product Designer", fit: 91, verified: true, assisted: "No", resume: "General" },
  { id: "a-2", name: "Dana Kim", role: "Product designer", jobTitle: "Product Designer", fit: 84, verified: true, assisted: "AI-prepared", resume: "Design-focused" },
  { id: "a-3", name: "Riley Chen", role: "Analyst", jobTitle: "Data Analyst", fit: 77, verified: true, assisted: "Bidder", resume: "General" },
  { id: "a-4", name: "Sam Okafor", role: "Support", jobTitle: "Support Lead", fit: 69, verified: false, assisted: "No", resume: "General" },
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
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
}

export const INITIAL_SAVED_JOB_IDS = ["support-lead-harbor"];
