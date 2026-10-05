import type { BadgeVariant } from "sid-ui";

/** Hiring workspace — prepaid balance. Purchases are credited in full. */

export type BillableEvent = {
  id: string;
  date: Date;
  candidate: string;
  jobId: string;
  jobTitle: string;
  amountCents: number;
  status: "billed" | "waived";
  note: string;
};

export type Purchase = {
  id: string;
  date: Date;
  amountCents: number;
};

export type BillingAccount = {
  plan: string;
  pricePerInterviewCents: number;
  balanceCents: number;
  purchasedCents: number;
  spentCents: number;
  currency: string;
  events: BillableEvent[];
  purchases: Purchase[];
};

export const BILLING_STATUS_META: Record<
  BillableEvent["status"],
  { label: string; badge: BadgeVariant }
> = {
  billed: { label: "Held", badge: "neutral" },
  waived: { label: "Returned", badge: "warning" },
};
