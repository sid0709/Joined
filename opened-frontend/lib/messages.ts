/** Inbox model both modes share: a candidate's company threads and a company's candidate threads. */

export type MessageAuthor = "them" | "you" | "event";

export type MailMessage = {
  id: string;
  from: MessageAuthor;
  text: string;
  /** Day label for the separator above a run of messages — "Today", "Monday", "Sep 18". */
  day: string;
  time: string;
  /** Delivery state of a message you sent. */
  status?: "sent" | "delivered" | "read";
};

/** Who is on the other side; decides the avatar shape. */
export type ThreadKind = "company" | "person" | "system";

export type ThreadDetail = { label: string; value: string };
export type ThreadLink = { label: string; href: string };

export type MailThread = {
  id: string;
  title: string;
  /** The job or application the conversation is about. */
  subtitle: string;
  kind: ThreadKind;
  /** Pipeline stage shown as a badge, when the thread belongs to one. */
  stage?: string;
  unread: number;
  details: ThreadDetail[];
  links: ThreadLink[];
  messages: MailMessage[];
};

/** Inbox views. */
export const INBOX_FILTERS = [
  { value: "inbox", label: "Inbox" },
  { value: "unread", label: "Unread" },
  { value: "archived", label: "Archived" },
] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number]["value"];

export const TODAY = "Today";

export function lastMessage(thread: MailThread): MailMessage | undefined {
  return thread.messages.at(-1);
}

/** Time for today's messages, the day label for anything older. */
export function lastActivity(thread: MailThread) {
  const last = lastMessage(thread);
  if (!last) return "";
  return last.day === TODAY ? last.time : last.day;
}

/** One line for the thread list: who spoke last and what they said. */
export function threadPreview(thread: MailThread) {
  const last = lastMessage(thread);
  if (!last) return "";
  return last.from === "you" ? `You: ${last.text}` : last.text;
}

export function totalUnread(threads: MailThread[]) {
  return threads.reduce((sum, thread) => sum + thread.unread, 0);
}

export function matchesQuery(thread: MailThread, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [thread.title, thread.subtitle, ...thread.messages.map((m) => m.text)].some((text) =>
    text.toLowerCase().includes(needle),
  );
}

export type BubblePosition = "first" | "middle" | "last" | undefined;

export type MessageRun = {
  day: string;
  from: MessageAuthor;
  messages: MailMessage[];
};

/**
 * Consecutive messages from one author on one day become a run: one name, one
 * avatar, stacked bubbles, and the timestamp under the last bubble only.
 */
export function groupMessages(messages: MailMessage[]): MessageRun[] {
  const runs: MessageRun[] = [];
  for (const message of messages) {
    const current = runs.at(-1);
    if (current && current.day === message.day && current.from === message.from) {
      current.messages.push(message);
    } else {
      runs.push({ day: message.day, from: message.from, messages: [message] });
    }
  }
  return runs;
}

export function bubblePosition(index: number, count: number): BubblePosition {
  if (count === 1) return undefined;
  if (index === 0) return "first";
  return index === count - 1 ? "last" : "middle";
}
