import type { BadgeVariant } from "@openseat/design-system";
import { daysFromToday } from "@/lib/dates";

/** Hiring workspace — billing — integer cents. Sample data until the API lands. */

export type BillableEvent = {
  id: string;
  date: Date;
  candidate: string;
  jobId: string;
  amountCents: number;
  status: "billed" | "free" | "waived";
  note: string;
};

export const BILLING = {
  plan: "Pay per interview",
  pricePerInterviewCents: 4_900,
  spendCents: 14_700,
  capCents: 200_000,
  freeInterviewsTotal: 10,
  freeInterviewsRemaining: 7,
  currency: "USD",
  paymentMethod: null as null | { brand: string; last4: string },
  renewsOn: daysFromToday(12),
} as const;

export const BILLABLE_EVENTS: BillableEvent[] = [
  {
    id: "b-1",
    date: daysFromToday(-4),
    candidate: "Jamie Ortiz",
    jobId: "cj-1",
    amountCents: 4_900,
    status: "billed",
    note: "Attended",
  },
  {
    id: "b-2",
    date: daysFromToday(-6),
    candidate: "Riley Chen",
    jobId: "cj-2",
    amountCents: 4_900,
    status: "billed",
    note: "Attended",
  },
  {
    id: "b-3",
    date: daysFromToday(-8),
    candidate: "Alex Rivera",
    jobId: "cj-1",
    amountCents: 4_900,
    status: "billed",
    note: "Attended",
  },
  {
    id: "b-4",
    date: daysFromToday(-10),
    candidate: "Sam Okafor",
    jobId: "cj-4",
    amountCents: 0,
    status: "waived",
    note: "No-show",
  },
  {
    id: "b-5",
    date: daysFromToday(-15),
    candidate: "Hannah Lee",
    jobId: "cj-3",
    amountCents: 0,
    status: "free",
    note: "Free interview",
  },
];

export const BILLING_STATUS_META: Record<
  BillableEvent["status"],
  { label: string; badge: BadgeVariant }
> = {
  billed: { label: "Billed", badge: "neutral" },
  free: { label: "Free", badge: "success" },
  waived: { label: "Not billed", badge: "warning" },
};
