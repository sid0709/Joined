import { CURRENCY, MOCK_OTP } from "./config";
import { newId } from "./format";
import { canSubmitToday, levelMetrics, recomputeLevel } from "./levels";
import { evaluateSubmission } from "./pipeline";
import { precheckUrl } from "./precheck";
import {
  availablePayoutCents,
  canRequestPayout,
  conversionRewardCents,
  holdUntil,
  rewardForSubmission,
} from "./rewards";
import { ROUTES } from "./routes";
import { seedState } from "./seed";
import type { Earning, ScoutAccount, ScoutNotification, StoreState, SubmitJobInput } from "./types";

export type ActionResult =
  { ok: true; state: StoreState } | { ok: false; error: string; state: StoreState };

function fail(state: StoreState, error: string): ActionResult {
  return { ok: false, error, state };
}

function ok(state: StoreState): ActionResult {
  return { ok: true, state };
}

export function activeUser(state: StoreState) {
  return state.users.find((user) => user.id === state.activeUserId) ?? null;
}

function requireUser(
  state: StoreState,
): { ok: true; user: ScoutAccount } | { ok: false; error: string } {
  const user = activeUser(state);
  if (!user) return { ok: false, error: "Sign in to continue." };
  return { ok: true, user };
}

function patchUser(state: StoreState, userId: string, patch: Partial<ScoutAccount>): StoreState {
  return {
    ...state,
    users: state.users.map((user) => (user.id === userId ? { ...user, ...patch } : user)),
  };
}

function notify(
  state: StoreState,
  userId: string,
  entry: Omit<ScoutNotification, "id" | "scoutUserId" | "unread" | "createdAt"> & {
    createdAt?: string;
  },
): StoreState {
  const item: ScoutNotification = {
    id: newId(),
    scoutUserId: userId,
    unread: true,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    ...entry,
  };
  return { ...state, notifications: [item, ...state.notifications] };
}

function addEarning(
  state: StoreState,
  user: ScoutAccount,
  partial: Omit<
    Earning,
    | "id"
    | "scoutUserId"
    | "currency"
    | "status"
    | "holdUntil"
    | "releasedAt"
    | "paidAt"
    | "createdAt"
  > & {
    createdAt?: string;
  },
): StoreState {
  const createdAt = partial.createdAt ?? new Date().toISOString();
  const earning: Earning = {
    id: newId(),
    scoutUserId: user.id,
    currency: CURRENCY,
    status: "held",
    holdUntil: holdUntil(createdAt),
    releasedAt: null,
    paidAt: null,
    createdAt,
    ...partial,
  };
  const next = { ...state, earnings: [earning, ...state.earnings] };
  if (!user.notifyRewards) return next;
  return notify(next, user.id, {
    title: `${partial.description}`,
    description: "Held until the window closes.",
    href: ROUTES.earnings,
    tone: "success",
  });
}

export function releaseDueHoldings(state: StoreState, now = new Date()): StoreState {
  const nowMs = now.getTime();
  return {
    ...state,
    earnings: state.earnings.map((item) => {
      if (item.status !== "held") return item;
      if (new Date(item.holdUntil).getTime() > nowMs) return item;
      return { ...item, status: "released", releasedAt: now.toISOString() };
    }),
  };
}

function refreshLevel(state: StoreState, userId: string): StoreState {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return state;
  const metrics = levelMetrics(user, state.submissions);
  const level = recomputeLevel(user.level, metrics);
  if (level === user.level) return state;
  const updated = patchUser(state, userId, { level });
  return notify(updated, userId, {
    title: `You are now ${level}`,
    description: "Daily limits and interview multipliers updated.",
    href: ROUTES.level,
    tone: "accent",
  });
}

export function signUp(
  state: StoreState,
  input: { name: string; email: string; passwordText: string },
): ActionResult {
  const email = input.email.trim().toLowerCase();
  if (!input.name.trim() || !email || input.passwordText.length < 8) {
    return fail(state, "Name, email, and an 8-character password are required.");
  }
  if (state.users.some((user) => user.email === email)) {
    return fail(state, "That email already has an account.");
  }
  const user: ScoutAccount = {
    id: newId(),
    name: input.name.trim(),
    email,
    passwordText: input.passwordText,
    phone: "",
    emailVerified: false,
    phoneVerified: false,
    acceptedTermsAt: null,
    verificationTier: 0,
    taxInfoComplete: false,
    payoutMethod: null,
    level: "probation",
    notifyDecisions: true,
    notifyRewards: true,
    createdAt: new Date().toISOString(),
  };
  return ok({ ...state, users: [...state.users, user], activeUserId: user.id });
}

export function signIn(state: StoreState, email: string, passwordText: string): ActionResult {
  const user = state.users.find(
    (item) => item.email === email.trim().toLowerCase() && item.passwordText === passwordText,
  );
  if (!user) return fail(state, "Email or password is wrong.");
  return ok({ ...state, activeUserId: user.id });
}

export function signOut(state: StoreState): StoreState {
  return { ...state, activeUserId: null };
}

export function acceptTerms(state: StoreState): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  return ok(patchUser(state, current.user.id, { acceptedTermsAt: new Date().toISOString() }));
}

export function verifyEmail(state: StoreState, code: string): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  if (code.trim() !== MOCK_OTP) return fail(state, `Use the demo code ${MOCK_OTP}.`);
  return ok(patchUser(state, current.user.id, { emailVerified: true }));
}

export function verifyPhone(state: StoreState, phone: string, code: string): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  if (phone.trim().length < 8) return fail(state, "Enter a real-looking phone number.");
  if (code.trim() !== MOCK_OTP) return fail(state, `Use the demo code ${MOCK_OTP}.`);
  return ok(
    patchUser(state, current.user.id, {
      phone: phone.trim(),
      phoneVerified: true,
      verificationTier: Math.max(
        current.user.verificationTier,
        1,
      ) as ScoutAccount["verificationTier"],
    }),
  );
}

export function verifyIdentity(state: StoreState): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  return ok(patchUser(state, current.user.id, { verificationTier: 2 }));
}

export function saveTaxInfo(state: StoreState): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  return ok(patchUser(state, current.user.id, { taxInfoComplete: true }));
}

export function savePayoutMethod(
  state: StoreState,
  method: NonNullable<ScoutAccount["payoutMethod"]>,
): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  return ok(patchUser(state, current.user.id, { payoutMethod: method }));
}

export function updateAccount(
  state: StoreState,
  patch: Partial<Pick<ScoutAccount, "name" | "notifyDecisions" | "notifyRewards">>,
): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  return ok(patchUser(state, current.user.id, patch));
}

export function needsOnboarding(user: ScoutAccount) {
  return !user.acceptedTermsAt || !user.emailVerified || !user.phoneVerified;
}

export function submitJob(state: StoreState, input: SubmitJobInput): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  const user = current.user;
  if (needsOnboarding(user)) return fail(state, "Finish scout onboarding first.");
  if (!canSubmitToday(user, state.submissions)) {
    return fail(state, "You have used today's submission limit.");
  }
  const mine = state.submissions.filter((item) => item.scoutUserId === user.id);
  const preview = precheckUrl(input.url, mine);
  const decision = evaluateSubmission(input, user, mine);
  const submittedAt = new Date().toISOString();
  const id = newId();
  const pending = {
    ...state,
    submissions: [
      {
        id,
        scoutUserId: user.id,
        jobId: decision.status === "approved" ? newId() : null,
        url: preview.url || input.url.trim(),
        canonicalUrl: preview.canonicalUrl || input.url.trim(),
        companyName: input.companyName.trim(),
        title: input.title.trim(),
        locationText: input.locationText.trim(),
        salaryText: input.salaryText.trim(),
        summary: input.summary.trim(),
        tags: input.tags,
        seniority: input.seniority,
        status: "auto_checking" as const,
        rejectionReason: "",
        autoCheckResults: [],
        hiddenJob: false,
        alreadyOnMajorBoards: false,
        applications: 0,
        interviews: 0,
        hires: 0,
        submittedAt,
        reviewedAt: null,
        expired: false,
      },
      ...state.submissions,
    ],
  };
  return completeAutoCheck(pending, id, decision);
}

export function completeAutoCheck(
  state: StoreState,
  submissionId: string,
  decision: ReturnType<typeof evaluateSubmission>,
): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  const submission = state.submissions.find((item) => item.id === submissionId);
  if (!submission) return fail(state, "Submission not found.");
  const reviewedAt = new Date().toISOString();
  let next: StoreState = {
    ...state,
    submissions: state.submissions.map((item) =>
      item.id === submissionId
        ? {
            ...item,
            status: decision.status,
            rejectionReason: decision.rejectionReason,
            autoCheckResults: decision.autoCheckResults,
            hiddenJob: decision.hiddenJob,
            alreadyOnMajorBoards: decision.alreadyOnMajorBoards,
            jobId: decision.status === "approved" ? (item.jobId ?? newId()) : item.jobId,
            reviewedAt: decision.status === "auto_checking" ? item.reviewedAt : reviewedAt,
          }
        : item,
    ),
  };
  const updated = next.submissions.find((item) => item.id === submissionId);
  if (!updated) return fail(state, "Submission not found.");
  if (current.user.notifyDecisions) {
    next = notify(next, current.user.id, {
      title: `${updated.title} is ${decision.status.replace("_", " ")}`,
      description: decision.rejectionReason || "Quality checks finished.",
      href: ROUTES.submission(submissionId),
      tone:
        decision.status === "approved"
          ? "success"
          : decision.status === "rejected"
            ? "danger"
            : "warning",
    });
  }
  if (decision.status === "approved") {
    const amount = rewardForSubmission("approval", current.user, {
      ...updated,
      alreadyOnMajorBoards: decision.alreadyOnMajorBoards,
    });
    if (amount > 0) {
      next = addEarning(next, current.user, {
        submissionId,
        type: "approval",
        amountCents: amount,
        description: `Approval credit · ${updated.title} at ${updated.companyName}`,
      });
    }
  }
  return ok(refreshLevel(next, current.user.id));
}

export function moderatorDecide(
  state: StoreState,
  submissionId: string,
  decision: "approved" | "rejected",
  reason = "",
): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  const submission = state.submissions.find((item) => item.id === submissionId);
  if (!submission || submission.status !== "needs_review") {
    return fail(state, "Only submissions in review can be decided.");
  }
  let next: StoreState = {
    ...state,
    submissions: state.submissions.map((item) =>
      item.id === submissionId
        ? {
            ...item,
            status: decision,
            rejectionReason: decision === "rejected" ? reason || "Rejected by moderator" : "",
            jobId: decision === "approved" ? (item.jobId ?? newId()) : item.jobId,
            reviewedAt: new Date().toISOString(),
          }
        : item,
    ),
  };
  if (decision === "approved") {
    const amount = rewardForSubmission("approval", current.user, submission);
    if (amount > 0) {
      next = addEarning(next, current.user, {
        submissionId,
        type: "approval",
        amountCents: amount,
        description: `Approval credit · ${submission.title} at ${submission.companyName}`,
      });
    }
  }
  next = notify(next, current.user.id, {
    title: `${submission.title} ${decision === "approved" ? "published" : "rejected"}`,
    description:
      decision === "approved"
        ? "The job is in the pool."
        : reason || "Moderator rejected this job.",
    href: ROUTES.submission(submissionId),
    tone: decision === "approved" ? "success" : "danger",
  });
  return ok(refreshLevel(next, current.user.id));
}

export function recordInterview(state: StoreState, submissionId: string): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  const submission = state.submissions.find((item) => item.id === submissionId);
  if (!submission || submission.status !== "approved" || submission.expired) {
    return fail(state, "Interviews only settle on live scouted jobs.");
  }
  const nextSubmissions = state.submissions.map((item) =>
    item.id === submissionId
      ? {
          ...item,
          interviews: item.interviews + 1,
          applications: Math.max(item.applications, item.interviews + 1),
        }
      : item,
  );
  let next: StoreState = { ...state, submissions: nextSubmissions };
  const amount = rewardForSubmission("interview", current.user, submission);
  next = addEarning(next, current.user, {
    submissionId,
    type: "interview",
    amountCents: amount,
    description: `Settled interview · ${submission.title} at ${submission.companyName}`,
  });
  return ok(refreshLevel(next, current.user.id));
}

export function recordHire(state: StoreState, submissionId: string): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  const submission = state.submissions.find((item) => item.id === submissionId);
  if (!submission || submission.status !== "approved")
    return fail(state, "Hires only confirm on approved jobs.");
  const nextSubmissions = state.submissions.map((item) =>
    item.id === submissionId ? { ...item, hires: item.hires + 1 } : item,
  );
  let next: StoreState = { ...state, submissions: nextSubmissions };
  next = addEarning(next, current.user, {
    submissionId,
    type: "hire",
    amountCents: rewardForSubmission("hire", current.user, submission),
    description: `Confirmed hire · ${submission.title} at ${submission.companyName}`,
  });
  return ok(next);
}

export function expireJob(state: StoreState, submissionId: string): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  return ok({
    ...state,
    submissions: state.submissions.map((item) =>
      item.id === submissionId ? { ...item, expired: true } : item,
    ),
  });
}

export function recordConversion(
  state: StoreState,
  submissionId: string,
  companyFeeCents: number,
): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  const submission = state.submissions.find((item) => item.id === submissionId);
  if (!submission) return fail(state, "Submission not found.");
  return ok(
    addEarning(state, current.user, {
      submissionId,
      type: "conversion",
      amountCents: conversionRewardCents(companyFeeCents),
      description: `Company conversion · ${submission.companyName} claimed their page`,
    }),
  );
}

export function clawBack(state: StoreState, earningId: string): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  return ok({
    ...state,
    earnings: state.earnings.map((item) =>
      item.id === earningId && item.scoutUserId === current.user.id
        ? { ...item, status: "clawed_back" }
        : item,
    ),
  });
}

export function requestPayout(state: StoreState): ActionResult {
  const current = requireUser(state);
  if (!current.ok) return fail(state, current.error);
  const mine = state.earnings.filter((item) => item.scoutUserId === current.user.id);
  if (!canRequestPayout(current.user, mine)) {
    return fail(state, "Payouts need tier 2, tax info, a payout method, and $25 released.");
  }
  const amount = availablePayoutCents(mine);
  const paidAt = new Date().toISOString();
  const nextEarnings = state.earnings.map((item) =>
    item.scoutUserId === current.user.id && item.status === "released"
      ? { ...item, status: "paid" as const, paidAt }
      : item,
  );
  let next: StoreState = {
    ...state,
    earnings: nextEarnings,
    payouts: [
      {
        id: newId(),
        scoutUserId: current.user.id,
        amountCents: amount,
        currency: CURRENCY,
        status: "paid",
        requestedAt: paidAt,
        paidAt,
      },
      ...state.payouts,
    ],
  };
  next = notify(next, current.user.id, {
    title: "Payout sent",
    description: "Released rewards moved to your payout method.",
    href: ROUTES.payouts,
    tone: "success",
  });
  return ok(next);
}

export function markNotificationRead(state: StoreState, id: string): StoreState {
  return {
    ...state,
    notifications: state.notifications.map((item) =>
      item.id === id ? { ...item, unread: false } : item,
    ),
  };
}

export function markAllNotificationsRead(state: StoreState): StoreState {
  const user = activeUser(state);
  if (!user) return state;
  return {
    ...state,
    notifications: state.notifications.map((item) =>
      item.scoutUserId === user.id ? { ...item, unread: false } : item,
    ),
  };
}

export function resetDemo(): StoreState {
  return seedState();
}
