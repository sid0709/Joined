import type { GlyphName } from "@openseat/design-system";
import type { Option } from "@/lib/profile";

export type SettingsSectionId =
  "account" | "notifications" | "alerts" | "connections" | "privacy" | "danger";

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  /** Shown under the section title on the right. */
  description: string;
  icon: GlyphName;
};

export type SettingsNavGroup = {
  title: string;
  sections: SettingsSection[];
};

export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    title: "Personal",
    sections: [
      {
        id: "account",
        label: "Account",
        description: "Your name, email, region, and how you sign in.",
        icon: "user",
      },
      {
        id: "notifications",
        label: "Notifications",
        description: "Choose what we tell you about, and where it reaches you.",
        icon: "bell",
      },
    ],
  },
  {
    title: "Job search",
    sections: [
      {
        id: "alerts",
        label: "Job alerts",
        description: "How often new matches arrive, and how good they need to be.",
        icon: "search",
      },
      {
        id: "connections",
        label: "Connected apps",
        description: "Link your calendar and email so we can find and confirm interviews.",
        icon: "link",
      },
    ],
  },
  {
    title: "Privacy",
    sections: [
      {
        id: "privacy",
        label: "Privacy & data",
        description: "Decide who can find you, and take your data with you.",
        icon: "lock",
      },
      {
        id: "danger",
        label: "Delete account",
        description: "Close your job-hunter account for good.",
        icon: "trash",
      },
    ],
  },
];

export const SETTINGS_SECTIONS: SettingsSection[] = SETTINGS_NAV.flatMap((group) => group.sections);

export type NotificationChannel = "email" | "push" | "sms";

export const CHANNELS: { id: NotificationChannel; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "push", label: "Push" },
  { id: "sms", label: "Text" },
];

export type NotificationEvent = {
  id: string;
  label: string;
  description: string;
  defaults: Record<NotificationChannel, boolean>;
};

export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  {
    id: "viewed",
    label: "Application viewed",
    description: "A company opened your application.",
    defaults: { email: true, push: true, sms: false },
  },
  {
    id: "replied",
    label: "Company replied",
    description: "A new message from a recruiter.",
    defaults: { email: true, push: true, sms: true },
  },
  {
    id: "interview",
    label: "Interview reminders",
    description: "The day before and an hour before.",
    defaults: { email: true, push: true, sms: true },
  },
  {
    id: "detected",
    label: "Detected invites",
    description: "We spotted an interview in your email.",
    defaults: { email: true, push: false, sms: false },
  },
  {
    id: "summary",
    label: "Weekly summary",
    description: "Your week in applications, every Monday.",
    defaults: { email: true, push: false, sms: false },
  },
  {
    id: "product",
    label: "Product news",
    description: "Occasional notes about Opened. At most one a month.",
    defaults: { email: false, push: false, sms: false },
  },
];

export const TIME_ZONES: Option[] = [
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
  { value: "America/Denver", label: "Mountain Time (US & Canada)" },
  { value: "America/Chicago", label: "Central Time (US & Canada)" },
  { value: "America/New_York", label: "Eastern Time (US & Canada)" },
  { value: "Europe/London", label: "London" },
];

export const LANGUAGES: Option[] = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es", label: "Español" },
];

export const ALERT_FREQUENCIES: Option[] = [
  { value: "instant", label: "Instant" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "off", label: "Off" },
];

export const ALERT_SOURCES: Option[] = [
  { value: "direct", label: "Direct jobs on Opened" },
  { value: "scouted", label: "Jobs found on company sites" },
  { value: "aggregated", label: "Jobs from job boards" },
];

export const MATCH_MIN = 50;
export const MATCH_MAX = 100;
export const MATCH_STEP = 5;
export const DEFAULT_MIN_MATCH = 75;

export type ProfileAudience = "public" | "recruiters" | "private";

export const AUDIENCES: { value: ProfileAudience; label: string; description: string }[] = [
  { value: "public", label: "Everyone", description: "Anyone with the link can see your profile." },
  {
    value: "recruiters",
    label: "Verified recruiters",
    description: "Only companies with a verified hiring account.",
  },
  {
    value: "private",
    label: "Only companies I apply to",
    description: "Nobody finds you in search.",
  },
];

export type Connection = {
  id: string;
  name: string;
  description: string;
  account?: string;
};

export const CONNECTIONS: Connection[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Adds interviews to your calendar and spots new invites.",
    account: "jordan.avery@example.com",
  },
  { id: "gmail", name: "Gmail", description: "Reads only messages from companies you applied to." },
  { id: "outlook", name: "Outlook", description: "Calendar and mail, for Microsoft accounts." },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Imports your work history into your profile.",
    account: "linkedin.com/in/jordanavery",
  },
];

export const DELETE_CONFIRMATION = "DELETE";

export const WEEK_STARTS: Option[] = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
];

export const QUIET_HOURS = { start: "21:00", end: "08:00" };

export type Session = {
  id: string;
  device: string;
  place: string;
  lastActive: string;
  isCurrent: boolean;
};

export const SESSIONS: Session[] = [
  {
    id: "s-1",
    device: "Chrome on macOS",
    place: "Chicago, IL",
    lastActive: "Active now",
    isCurrent: true,
  },
  {
    id: "s-2",
    device: "Opened for iPhone",
    place: "Chicago, IL",
    lastActive: "2 days ago",
    isCurrent: false,
  },
  {
    id: "s-3",
    device: "Safari on iPad",
    place: "Milwaukee, WI",
    lastActive: "3 weeks ago",
    isCurrent: false,
  },
];

/** Rough weekly match volume at a 50% bar; the estimate scales down as the bar rises. */
export const WEEKLY_MATCHES_AT_MIN = 40;

export function estimateWeeklyMatches(minMatch: number) {
  const share = (MATCH_MAX - minMatch) / (MATCH_MAX - MATCH_MIN);
  return Math.max(1, Math.round(WEEKLY_MATCHES_AT_MIN * share));
}

export const PAUSE_DAYS = 30;
