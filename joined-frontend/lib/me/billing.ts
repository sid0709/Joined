import {
  checkoutRequest,
  portalRequest,
  type BillingPlan,
  type BillingSubscription,
  type SessionUrlResponse,
} from "@/lib/billing";
import { meGet, meSend } from "@/lib/me/client";

export function fetchSubscription() {
  return meGet<BillingSubscription>("/billing/subscription");
}

export function startCheckout(plan: BillingPlan, origin: string) {
  return meSend<SessionUrlResponse>("/billing/checkout", "POST", checkoutRequest(plan, origin));
}

export function startPortal(origin: string) {
  return meSend<SessionUrlResponse>("/billing/portal", "POST", portalRequest(origin));
}
