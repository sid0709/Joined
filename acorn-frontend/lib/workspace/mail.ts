import type { BadgeVariant, ChartTone, GlyphName } from "sid-ui";
import { stageOf, type Application } from "./applications";
import { addDays, daysBetween, formatDay, weekStart, type Day } from "./dates";

/**
 * Application mail, sorted into the labels Acorn cares about. Nothing reads Gmail yet:
 * acorn-backend has no mail endpoint, so the inbox is built from the sample applications
 * and lands in whichever mailbox is the default.
 */

export const MAIL_LABELS = {
  interview: { label: "Interview", badge: "blue", tone: "blue", icon: "calendar" },
  "next-step": { label: "Next step", badge: "orange", tone: "orange", icon: "send" },
  offer: { label: "Offer", badge: "success", tone: "green", icon: "star" },
  received: { label: "Received", badge: "neutral", tone: "neutral", icon: "check" },
  closed: { label: "Closed", badge: "neutral", tone: "neutral", icon: "archive" },
} as const satisfies Record<
  string,
  { label: string; badge: BadgeVariant; tone: ChartTone; icon: GlyphName }
>;

export type MailLabel = keyof typeof MAIL_LABELS;
export const MAIL_LABEL_ORDER: MailLabel[] = [
  "interview",
  "next-step",
  "offer",
  "received",
  "closed",
];

export type MailMessage = {
  id: string;
  applicationId: string;
  sender: string;
  senderEmail: string;
  company: string;
  role: string;
  subject: string;
  snippet: string;
  body: string[];
  label: MailLabel;
  receivedOn: Day;
  /** Minutes after midnight. */
  receivedAt: number;
};

/** Messages from the last few days start unread. */
const UNREAD_DAYS = 3;
const RECEIPT_EVERY = 3;
const WORKDAY_START = 8 * 60;
const WORKDAY_MINUTES = 9 * 60;
const MAIL_LIMIT = 80;

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function minuteOf(id: string, salt: number) {
  let hash = salt;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return WORKDAY_START + (hash % WORKDAY_MINUTES);
}

function message(
  app: Application,
  label: MailLabel,
  on: Day,
  copy: { subject: string; snippet: string; body: string[] },
  fromTeam = false,
): MailMessage {
  const first = app.contact.split(" ")[0];
  return {
    id: `${app.id}-${label}`,
    applicationId: app.id,
    sender: fromTeam ? `${app.company} Recruiting` : app.contact,
    senderEmail: fromTeam
      ? `jobs@${slug(app.company)}.com`
      : `${slug(first)}@${slug(app.company)}.com`,
    company: app.company,
    role: app.role,
    label,
    receivedOn: on,
    receivedAt: minuteOf(app.id, label.length),
    ...copy,
  };
}

export function mailFromApplications(apps: Application[], today: Day): MailMessage[] {
  const messages: MailMessage[] = [];
  apps.forEach((app, index) => {
    if (!app.appliedOn) return;
    const stage = stageOf(app);
    const sign = `— ${app.contact}, ${app.company}`;
    if (index % RECEIPT_EVERY === 0) {
      messages.push(
        message(
          app,
          "received",
          app.appliedOn,
          {
            subject: `We received your application for ${app.role}`,
            snippet: "Thanks for applying. Our team reviews every application.",
            body: [
              `Thanks for applying to ${app.role} at ${app.company}.`,
              "Our team reviews every application and will reach out if there is a match.",
            ],
          },
          true,
        ),
      );
    }
    if (app.rejectedOn) {
      messages.push(
        message(app, "closed", app.rejectedOn, {
          subject: `Your application to ${app.company}`,
          snippet: "We've decided to move forward with other candidates for this role.",
          body: [
            `Thank you for your interest in ${app.role}.`,
            "After careful review we've decided to move forward with other candidates. We'll keep your résumé on file for future openings.",
            sign,
          ],
        }),
      );
      return;
    }
    if (app.repliedOn && !app.interviewOn) {
      messages.push(
        message(app, "next-step", app.repliedOn, {
          subject: `Next step: ${app.role}`,
          snippet: "Could you confirm your salary range and earliest start date?",
          body: [
            `Thanks for applying to ${app.role}. Your background looks like a strong fit.`,
            "Before we schedule a conversation, could you confirm your salary range and earliest start date?",
            sign,
          ],
        }),
      );
    }
    if (app.repliedOn && app.interviewOn) {
      messages.push(
        message(app, "interview", app.repliedOn, {
          subject: `Interview request — ${app.role}`,
          snippet: "We'd love to set up a 45-minute conversation with the team.",
          body: [
            `Hi — I'm on the hiring team at ${app.company}. We'd love to talk about ${app.role}.`,
            "Would a 45-minute video call with two engineers work for you? I've suggested a time on the invite.",
            sign,
          ],
        }),
      );
    }
    if (stage === "offer" && app.offerOn) {
      messages.push(
        message(app, "offer", app.offerOn, {
          subject: `Offer: ${app.role} at ${app.company}`,
          snippet: "We're excited to extend an offer. Details are attached.",
          body: [
            `Congratulations — the team at ${app.company} would like you to join as ${app.role}.`,
            "The offer letter is attached. Let me know a good time to walk through it together.",
            sign,
          ],
        }),
      );
    }
  });
  return messages
    .filter((mail) => mail.receivedOn <= today)
    .sort((a, b) => b.receivedOn.localeCompare(a.receivedOn) || b.receivedAt - a.receivedAt)
    .slice(0, MAIL_LIMIT);
}

/** Recent mail starts unread unless the reader opened it. */
export function isUnread(mail: MailMessage, today: Day, read: string[]) {
  return daysBetween(mail.receivedOn, today) < UNREAD_DAYS && !read.includes(mail.id);
}

/** The first day that still counts as recent, for the "this week" figures. */
export function recentFrom(today: Day, days: number) {
  return addDays(today, 1 - days);
}

/** Labels the reply chart plots — application receipts are automatic, not replies. */
export const REPLY_LABELS: MailLabel[] = ["interview", "next-step", "offer", "closed"];
const MAIL_TREND_WEEKS = 10;
const DAYS_PER_WEEK = 7;

export function repliesByWeek(mail: MailMessage[], today: Day) {
  const first = addDays(weekStart(today), -(MAIL_TREND_WEEKS - 1) * DAYS_PER_WEEK);
  const labels = Array.from({ length: MAIL_TREND_WEEKS }, (_, index) =>
    formatDay(addDays(first, index * DAYS_PER_WEEK)),
  );
  const series = REPLY_LABELS.map((label) => {
    const values = labels.map(() => 0);
    mail.forEach((message) => {
      if (message.label !== label || message.receivedOn < first) return;
      values[Math.floor(daysBetween(first, message.receivedOn) / DAYS_PER_WEEK)] += 1;
    });
    return { label: MAIL_LABELS[label].label, values, tone: MAIL_LABELS[label].tone };
  });
  return { labels, series };
}

export function countByLabel(mail: MailMessage[]): Record<MailLabel, number> {
  const counts = Object.fromEntries(MAIL_LABEL_ORDER.map((label) => [label, 0])) as Record<
    MailLabel,
    number
  >;
  mail.forEach((message) => {
    counts[message.label] += 1;
  });
  return counts;
}
