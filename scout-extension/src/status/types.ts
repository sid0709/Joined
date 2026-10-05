export const SUBMISSION_CHANGE_EVENTS = ["accepted", "rejected", "published", "earned"] as const;
export const NOTIFIABLE_EVENTS = ["accepted", "rejected", "earned"] as const;

export type SubmissionChangeEvent = (typeof SUBMISSION_CHANGE_EVENTS)[number];
export type NotifiableEvent = (typeof NOTIFIABLE_EVENTS)[number];

export interface ScoutStatusNotification {
  id: string;
  kind: string;
  tone: string;
  title: string;
  body: string;
  subject_id?: string;
  event?: SubmissionChangeEvent;
  read: boolean;
  created_at: string;
}

export interface NotificationPage {
  data: ScoutStatusNotification[];
  next_cursor: string;
  unread_count: number;
}

export interface StatusPollState {
  since: string;
  seenKeys: string[];
  bootstrapped: boolean;
}

export function isSubmissionChangeEvent(value: unknown): value is SubmissionChangeEvent {
  return (
    typeof value === "string" && (SUBMISSION_CHANGE_EVENTS as readonly string[]).includes(value)
  );
}

export function isNotifiableEvent(value: unknown): value is NotifiableEvent {
  return typeof value === "string" && (NOTIFIABLE_EVENTS as readonly string[]).includes(value);
}
