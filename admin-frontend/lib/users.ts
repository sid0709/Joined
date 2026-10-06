import { adminSend } from "@/lib/api";

export const USERS_PATH = "/v1/admin/users";

export type UserTimeline = { at: string; label: string };

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  suspended: boolean;
  premium: boolean;
  premiumStatus: string;
  timeline: UserTimeline[];
};

export type UserActionResult = { user: AdminUser; auditId: string };

export type UserAction = "cancel" | "refund" | "suspend" | "unsuspend";

const ACTION_PATH: Record<UserAction, string> = {
  cancel: "premium/cancel",
  refund: "premium/refund",
  suspend: "suspend",
  unsuspend: "unsuspend",
};

/** A reason must be non-empty before cancel, refund, or suspend can be sent. */
export function canSubmitUserAction(reason: string, amountCents?: number) {
  if (reason.trim().length === 0) return false;
  if (amountCents === undefined) return true;
  return Number.isInteger(amountCents) && amountCents > 0;
}

export function userLookupPath(email: string, id: string) {
  const params = new URLSearchParams();
  const trimmedEmail = email.trim();
  const trimmedId = id.trim();
  if (trimmedEmail) params.set("email", trimmedEmail);
  else if (trimmedId) params.set("id", trimmedId);
  const query = params.toString();
  return query ? `${USERS_PATH}?${query}` : "";
}

export function userDetailPath(id: string) {
  return `${USERS_PATH}/${encodeURIComponent(id)}`;
}

export function runUserAction(
  id: string,
  action: UserAction,
  reason: string,
  amountCents?: number,
) {
  const body: { reason: string; amount_cents?: number } = { reason: reason.trim() };
  if (action === "refund") body.amount_cents = amountCents;
  return adminSend<UserActionResult>(`${userDetailPath(id)}/${ACTION_PATH[action]}`, "POST", body);
}
