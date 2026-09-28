import type { GlyphName } from "@openseat/design-system";
import type { Option } from "@/lib/profile";
import type { Connection, NotificationEvent } from "@/lib/settings";

/**
 * Hiring workspace — you, not the company: your hiring profile, how you
 * interview, and your own account settings. Sample data until the API lands.
 */

export type HiringProfile = {
  title: string;
  about: string;
  meetingLink: string;
  interviewLength: string;
  buffer: string;
  dayStart: string;
  dayEnd: string;
  interviewDays: string[];
  timeZone: string;
  signature: string;
  isVisibleToCandidates: boolean;
};

export const MY_HIRING_PROFILE: HiringProfile = {
  title: "Head of Talent",
  about:
    "I run hiring for design and data. Expect a straight answer on pay, the team, and next steps within two working days.",
  meetingLink: "meet.google.com/opn-hire-now",
  interviewLength: "45",
  buffer: "15",
  dayStart: "09:30",
  dayEnd: "17:00",
  interviewDays: ["mon", "tue", "wed", "thu"],
  timeZone: "America/Chicago",
  signature: "Talent team · Replies within two working days",
  isVisibleToCandidates: true,
};

export const INTERVIEW_LENGTHS: Option[] = [
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "60 minutes" },
  { value: "90", label: "90 minutes" },
];

export const INTERVIEW_BUFFERS: Option[] = [
  { value: "0", label: "No buffer" },
  { value: "10", label: "10 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
];

export const WEEKDAYS: Option[] = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
];

export const ABOUT_MAX_LENGTH = 280;

/** What a person in the hiring workspace hears about — their jobs, candidates, and interviews. */
export const HIRING_NOTIFICATION_EVENTS: NotificationEvent[] = [
  {
    id: "new-applicant",
    label: "New applicant",
    description: "Someone applied to a job you own.",
    defaults: { email: true, push: true, sms: false },
  },
  {
    id: "candidate-reply",
    label: "Candidate replied",
    description: "A new message in a conversation you’re in.",
    defaults: { email: true, push: true, sms: false },
  },
  {
    id: "interview-reminder",
    label: "Interview reminders",
    description: "An hour before any interview you’re on.",
    defaults: { email: true, push: true, sms: true },
  },
  {
    id: "feedback-due",
    label: "Feedback due",
    description: "Your scorecard is still open a day after an interview.",
    defaults: { email: true, push: false, sms: false },
  },
  {
    id: "mention",
    label: "Mentions",
    description: "A teammate mentioned you in a note on a candidate.",
    defaults: { email: true, push: true, sms: false },
  },
  {
    id: "daily-digest",
    label: "Daily hiring digest",
    description: "Pipeline movement across your jobs, every weekday at 8 AM.",
    defaults: { email: true, push: false, sms: false },
  },
];

/** The tools you interview with. Company-wide integrations live in Company settings. */
export const HIRING_CONNECTIONS: Connection[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Finds your free time and adds every interview you’re on.",
    account: "you@company.example",
  },
  { id: "outlook", name: "Outlook", description: "Calendar and mail, for Microsoft accounts." },
  {
    id: "google-meet",
    name: "Google Meet",
    description: "Creates a video link for each interview you schedule.",
    account: "Default for video rounds",
  },
  { id: "zoom", name: "Zoom", description: "Use your Zoom room instead of Google Meet." },
];

export const HIRING_CONNECTIONS_NOTICE = {
  title: "Only your own calendar and video tools",
  description:
    "These are yours alone. Company-wide integrations like your careers site belong in Company settings.",
};

export type AccountSectionId = "account" | "notifications" | "connections" | "danger";

export type AccountSection = {
  id: AccountSectionId;
  label: string;
  description: string;
  icon: GlyphName;
};

export const ACCOUNT_NAV: { title: string; sections: AccountSection[] }[] = [
  {
    title: "You",
    sections: [
      {
        id: "account",
        label: "Sign-in & security",
        description: "Your email, password, two-step sign-in, and devices.",
        icon: "lock",
      },
      {
        id: "notifications",
        label: "Notifications",
        description: "What you hear about your jobs, candidates, and interviews.",
        icon: "bell",
      },
      {
        id: "connections",
        label: "Calendar & video",
        description: "The calendar and meeting tools you interview with.",
        icon: "calendar",
      },
    ],
  },
  {
    title: "Account",
    sections: [
      {
        id: "danger",
        label: "Delete account",
        description: "Remove your account. The company stays unless you created it.",
        icon: "trash",
      },
    ],
  },
];
