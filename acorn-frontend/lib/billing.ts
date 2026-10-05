import { addDays, type Day } from "./workspace/dates";

/**
 * Plans, limits, and the billing cycle. No payment provider is connected yet, so the
 * current plan and invoices are a sample; checkout buttons stay off until one is.
 */

export type BillingInterval = "monthly" | "yearly";
export type PlanId = "free" | "pro" | "unlimited";

/** null means no limit. */
export type PlanLimits = {
  applications: number | null;
  drafts: number | null;
  mailboxes: number | null;
};

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Whole dollars per month for each interval; yearly is billed once a year. */
  price: Record<BillingInterval, number>;
  limits: PlanLimits;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try Acorn on a handful of postings.",
    price: { monthly: 0, yearly: 0 },
    limits: { applications: 30, drafts: 3, mailboxes: 1 },
    features: [
      "30 applications a month",
      "3 resume drafts a month",
      "1 Gmail mailbox",
      "Statistics",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For an active search.",
    price: { monthly: 19, yearly: 15 },
    limits: { applications: 300, drafts: 50, mailboxes: 3 },
    features: [
      "300 applications a month",
      "50 resume drafts a month",
      "3 Gmail mailboxes",
      "Gmail auto-label",
      "Autofill on every supported job site",
    ],
  },
  {
    id: "unlimited",
    name: "Unlimited",
    tagline: "No caps, the best models first.",
    price: { monthly: 39, yearly: 31 },
    limits: { applications: null, drafts: null, mailboxes: 10 },
    features: [
      "Unlimited applications",
      "Unlimited resume drafts",
      "10 Gmail mailboxes",
      "Priority AI models",
      "Early access to new features",
    ],
  },
];

export const BILLING_CYCLE_DAYS = 30;
const INVOICE_COUNT = 6;
const MONTHS_PER_YEAR = 12;

/** The plan this workspace is on until a payment provider reports the real one. */
export const SAMPLE_SUBSCRIPTION = {
  planId: "pro" as PlanId,
  interval: "monthly" as BillingInterval,
  /** Days into the current cycle. */
  dayOfCycle: 18,
  card: { brand: "Visa", last4: "4242", expires: "08/28" },
};

export function planById(id: PlanId) {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0];
}

/** "$19" or "$0". */
export function formatPrice(dollars: number) {
  return `$${dollars.toLocaleString()}`;
}

export function yearlySaving(plan: Plan) {
  return (plan.price.monthly - plan.price.yearly) * MONTHS_PER_YEAR;
}

export type Cycle = { start: Day; renews: Day };

export function currentCycle(today: Day): Cycle {
  const start = addDays(today, -SAMPLE_SUBSCRIPTION.dayOfCycle);
  return { start, renews: addDays(start, BILLING_CYCLE_DAYS) };
}

export type Invoice = {
  id: string;
  on: Day;
  description: string;
  amount: number;
  status: "paid" | "upcoming";
};

/** The next charge, then the last few, newest first. */
export function sampleInvoices(today: Day): Invoice[] {
  const plan = planById(SAMPLE_SUBSCRIPTION.planId);
  const cycle = currentCycle(today);
  const amount = plan.price[SAMPLE_SUBSCRIPTION.interval];
  const upcoming: Invoice = {
    id: "inv-next",
    on: cycle.renews,
    description: `${plan.name} · monthly`,
    amount,
    status: "upcoming",
  };
  const paid = Array.from({ length: INVOICE_COUNT }, (_, index) => ({
    id: `inv-${index}`,
    on: addDays(cycle.start, -index * BILLING_CYCLE_DAYS),
    description: `${plan.name} · monthly`,
    amount,
    status: "paid" as const,
  }));
  return [upcoming, ...paid];
}
