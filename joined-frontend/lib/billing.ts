import type { BadgeVariant } from "sid-ui";
import { formatLongDate } from "@/lib/dates";
import { ROUTES, settingsSectionHref } from "@/lib/routes";

/** Same plan ids the step-29 billing API accepts. */
export const BILLING_PLANS = ["monthly", "yearly"] as const;
export type BillingPlan = (typeof BILLING_PLANS)[number];

export const MONTHS_PER_YEAR = 12;

export type BillingSubscription = {
  premium: boolean;
  status?: string;
  plan?: string;
  current_period_end?: string;
};

export type CheckoutRequest = {
  plan: BillingPlan;
  success_url: string;
  cancel_url: string;
};

export type PortalRequest = {
  return_url: string;
};

export type SessionUrlResponse = {
  url: string;
};

export type PremiumPrices = {
  monthlyCents: number;
  yearlyCents: number;
  currency: string;
};

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_META: Record<
  SubscriptionStatus,
  { label: string; badge: BadgeVariant }
> = {
  active: { label: "Active", badge: "success" },
  trialing: { label: "Trial", badge: "info" },
  past_due: { label: "Past due", badge: "warning" },
  canceled: { label: "Canceled", badge: "neutral" },
  unpaid: { label: "Unpaid", badge: "warning" },
  incomplete: { label: "Incomplete", badge: "warning" },
  incomplete_expired: { label: "Expired", badge: "neutral" },
};

export const UNKNOWN_STATUS_META: { label: string; badge: BadgeVariant } = {
  label: "Unknown",
  badge: "neutral",
};

export const PREMIUM_FEATURES = [
  "Hidden jobs that are not on the big boards.",
  "Manage or cancel anytime in the Stripe billing portal.",
];

export const BILLING_MESSAGES = {
  checkoutFailed: "Could not start checkout.",
  portalFailed: "Could not open the billing portal.",
  missingCheckoutUrl: "Checkout did not return a URL.",
  missingPortalUrl: "The billing portal did not return a URL.",
  checkoutDisabledTitle: "Checkout is paused",
  checkoutDisabledDescription:
    "New Premium upgrades are turned off right now. You can still manage an existing plan.",
  freePlan: "Free",
  noRenewal: "—",
  manageBilling: "Manage billing",
  seePlans: "See plans",
  upgrade: "Upgrade",
  currentPlan: "Current plan",
  signInToUpgrade: "Sign in to upgrade",
};

export const PRICING_PAGE = {
  href: ROUTES.pricing,
  label: "Premium",
  description: "Monthly and yearly Joined Premium. Test-mode checkout only.",
} as const;

export function isBillingPlan(value: string | undefined | null): value is BillingPlan {
  return value === "monthly" || value === "yearly";
}

export function parseBillingPlan(value: string | undefined | null): BillingPlan | null {
  return isBillingPlan(value) ? value : null;
}

export function planLabel(plan: BillingPlan): string {
  switch (plan) {
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
    default: {
      const _never: never = plan;
      return _never;
    }
  }
}

export function planIntervalLabel(plan: BillingPlan): string {
  switch (plan) {
    case "monthly":
      return "month";
    case "yearly":
      return "year";
    default: {
      const _never: never = plan;
      return _never;
    }
  }
}

export function parseSubscriptionStatus(
  value: string | undefined | null,
): SubscriptionStatus | null {
  switch (value) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return value;
    default:
      return null;
  }
}

export function subscriptionStatusMeta(status: string | undefined | null) {
  const parsed = parseSubscriptionStatus(status);
  if (!parsed) {
    return status ? { label: status, badge: UNKNOWN_STATUS_META.badge } : UNKNOWN_STATUS_META;
  }
  return SUBSCRIPTION_STATUS_META[parsed];
}

export function formatRenewalDate(value: string | undefined | null) {
  if (!value) return BILLING_MESSAGES.noRenewal;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return BILLING_MESSAGES.noRenewal;
  return formatLongDate(date);
}

export function yearlySavingsCents(monthlyCents: number, yearlyCents: number) {
  return MONTHS_PER_YEAR * monthlyCents - yearlyCents;
}

export function planAmountCents(plan: BillingPlan, prices: PremiumPrices) {
  switch (plan) {
    case "monthly":
      return prices.monthlyCents;
    case "yearly":
      return prices.yearlyCents;
    default: {
      const _never: never = plan;
      return _never;
    }
  }
}

export function hasStripeCustomer(subscription: BillingSubscription | null | undefined) {
  if (!subscription) return false;
  return Boolean(subscription.premium || subscription.status || subscription.plan);
}

export function currentBillingPlan(subscription: BillingSubscription | null | undefined) {
  if (!subscription?.premium) return null;
  return parseBillingPlan(subscription.plan);
}

export function checkoutRequest(plan: BillingPlan, origin: string): CheckoutRequest {
  return {
    plan,
    success_url: `${origin}${ROUTES.billingSuccess}`,
    cancel_url: `${origin}${ROUTES.billingCancel}`,
  };
}

export function portalRequest(origin: string): PortalRequest {
  return { return_url: `${origin}${settingsSectionHref("billing")}` };
}
