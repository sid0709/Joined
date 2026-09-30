"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import type {
  Assessment,
  BidderApplication,
  BidderAssignment,
  BidderInterview,
  BidderNotification,
  BidderNotificationKind,
  BidderProfile,
  ChatMessage,
  Engagement,
  Invitation,
  Payout,
  Review,
  WalletTransaction,
} from "@/src/candidate/types/workspace";

import {
  ASSESSMENT_QUIZ,
  INITIAL_ASSESSMENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_PROFILE,
  SEED_TRANSACTIONS,
} from "@/src/candidate/data/account";
import { BOARD_TASK_BY_ID, HUNTER_BY_ID } from "@/src/candidate/data/board";
import {
  INITIAL_ENGAGEMENTS,
  INITIAL_INTERVIEWS,
  INITIAL_INVITATIONS,
  INITIAL_SAVED_TASKS,
} from "@/src/candidate/data/pipeline";
import {
  BIDDER_ID,
  INITIAL_APPLICATIONS,
  INITIAL_ASSIGNMENTS,
  INITIAL_REVIEWS,
} from "@/src/candidate/data/work";
import { buildPayouts, MIN_EARLY_PAYOUT, sumNet } from "@/src/candidate/lib/derive";
import { hunterReply } from "@/src/candidate/lib/hunterReplies";
import { MOCK_NOW } from "@/src/shared/mock/clock";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { POOL_JOBS } from "@/src/shared/mock/pool";

const REPLY_DELAY_MS = 1600;
const ASSIGN_DELAY_MS = 3200;
const FIRST_BATCH_MAX = 8;
const PASS_MARK = 67;

const CLOCK_LEAD_MS = 30_000;
const CLOCK_TICK_MS = 10;
let clockTick = 0;
/** Monotonic mock clock that stays just behind the fixed mock "now", so new items read as just now and stay ordered. */
const nowIso = () =>
  new Date(MOCK_NOW.getTime() - CLOCK_LEAD_MS + ++clockTick * CLOCK_TICK_MS).toISOString();

let serial = 0;
const uid = (prefix: string) => {
  serial += 1;
  return `${prefix}-${Date.now().toString(36)}${serial}`;
};

interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface ContactInput {
  taskId: string;
  pitch: string;
  weeklyCapacity: number;
  proposedRates: { packageId: string; rate: number }[];
}

export interface SubmitInput {
  confirmation: string;
  minutesSpent: number;
  evidenceNote: string;
}

interface WorkspaceValue {
  profile: BidderProfile;
  engagements: Engagement[];
  invitations: Invitation[];
  interviews: BidderInterview[];
  assignments: BidderAssignment[];
  applications: BidderApplication[];
  reviews: Review[];
  notifications: BidderNotification[];
  assessments: Assessment[];
  transactions: WalletTransaction[];
  payouts: Payout[];
  savedTaskIds: string[];
  typingIds: string[];
  unreadMessages: number;
  unreadNotifications: number;
  engagementForTask: (taskId: string) => Engagement | undefined;
  hasAssessment: (assessmentId?: string) => boolean;
  toggleSaved: (taskId: string) => void;
  contactTask: (input: ContactInput) => ActionResult;
  sendMessage: (engagementId: string, body: string) => void;
  markRead: (engagementId: string) => void;
  withdrawEngagement: (engagementId: string) => void;
  proposeRates: (engagementId: string, rates: { packageId: string; rate: number }[]) => void;
  respondInvitation: (invitationId: string, decision: "accept" | "decline") => ActionResult;
  cancelInterview: (interviewId: string) => void;
  rescheduleInterview: (interviewId: string, date: string, start: string) => void;
  startApplication: (applicationId: string) => void;
  submitApplication: (applicationId: string, input: SubmitInput) => ActionResult;
  askHunter: (applicationId: string, question: string) => void;
  replyToReview: (reviewId: string, body: string) => void;
  acknowledgeReview: (reviewId: string) => void;
  disputeReview: (reviewId: string, reason: string) => void;
  requestEarlyPayout: (amount: number) => ActionResult;
  updateProfile: (patch: Partial<BidderProfile>) => void;
  submitAssessment: (assessmentId: string, answers: number[]) => { score: number; passed: boolean };
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const Context = createContext<WorkspaceValue | undefined>(undefined);

export function BidderWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [engagements, setEngagements] = useState(INITIAL_ENGAGEMENTS);
  const [invitations, setInvitations] = useState(INITIAL_INVITATIONS);
  const [interviews, setInterviews] = useState(INITIAL_INTERVIEWS);
  const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS);
  const [applications, setApplications] = useState(INITIAL_APPLICATIONS);
  const [reviews, setReviews] = useState(INITIAL_REVIEWS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [assessments, setAssessments] = useState(INITIAL_ASSESSMENTS);
  const [transactions, setTransactions] = useState(SEED_TRANSACTIONS);
  const [savedTaskIds, setSavedTaskIds] = useState(INITIAL_SAVED_TASKS);
  const [typingIds, setTypingIds] = useState<string[]>([]);

  const latest = useRef({ engagements, assessments, applications });
  latest.current = { engagements, assessments, applications };

  const payouts = useMemo(
    () => buildPayouts(applications, assignments),
    [applications, assignments],
  );

  const notify = useCallback(
    (kind: BidderNotificationKind, title: string, body: string, href: string) =>
      setNotifications((current) => [
        { id: uid("bn"), kind, title, body, at: nowIso(), read: false, href },
        ...current,
      ]),
    [],
  );

  const patchEngagement = useCallback(
    (id: string, update: (engagement: Engagement) => Engagement) =>
      setEngagements((current) =>
        current.map((engagement) => (engagement.id === id ? update(engagement) : engagement)),
      ),
    [],
  );

  const hasAssessment = useCallback(
    (assessmentId?: string) =>
      !assessmentId ||
      assessments.some(
        (assessment) => assessment.id === assessmentId && assessment.status === "passed",
      ),
    [assessments],
  );

  const assignFirstBatch = useCallback(
    (engagementId: string) => {
      const engagement = latest.current.engagements.find((item) => item.id === engagementId);
      const task = engagement && BOARD_TASK_BY_ID.get(engagement.taskId);
      if (!engagement || !task) return;
      const line =
        task.packageLines.find((item) =>
          engagement.proposedRates.some((rate) => rate.packageId === item.packageId),
        ) ?? task.packageLines[0];
      const tier = PACKAGE_BY_ID.get(line.packageId);
      if (!tier) return;
      const used = new Set(latest.current.applications.map((application) => application.jobId));
      const jobs = POOL_JOBS.filter((job) => tier.ats.includes(job.ats) && !used.has(job.id)).slice(
        0,
        Math.min(line.quota, FIRST_BATCH_MAX),
      );
      if (!jobs.length) return;
      const assignmentId = uid("asg");
      const rate =
        engagement.proposedRates.find((item) => item.packageId === line.packageId)?.rate ??
        line.rate;
      const due = new Date(MOCK_NOW.getTime() + 5 * 86_400_000).toISOString();
      setAssignments((current) => [
        ...current,
        {
          id: assignmentId,
          engagementId,
          taskId: task.id,
          packageId: line.packageId,
          rate,
          jobIds: jobs.map((job) => job.id),
          assignedAt: nowIso(),
          dueAt: due,
          dailyTarget: task.dailyTarget,
          status: "active",
          note: `First batch from ${HUNTER_BY_ID.get(task.hunterId)?.name ?? "your hunter"}. Send a short summary in chat at the end of each day.`,
        },
      ]);
      setApplications((current) => [
        ...current,
        ...jobs.map((job, index) => ({
          id: `${assignmentId}-app-${String(index + 1).padStart(2, "0")}`,
          assignmentId,
          taskId: task.id,
          packageId: line.packageId,
          jobId: job.id,
          bidderId: BIDDER_ID,
          status: "queued" as const,
          updatedAt: nowIso(),
        })),
      ]);
      patchEngagement(engagementId, (item) => ({
        ...item,
        unread: item.unread + 1,
        messages: [
          ...item.messages,
          {
            id: uid("m"),
            sender: "system",
            body: `${jobs.length} links were assigned to you. Open My Work to start.`,
            at: nowIso(),
          },
        ],
      }));
      notify(
        "work",
        `${jobs.length} new links assigned`,
        `${HUNTER_BY_ID.get(task.hunterId)?.name} assigned ${jobs.length} ${tier.name} links to you.`,
        "/marketplace/candidate/work",
      );
    },
    [notify, patchEngagement],
  );

  const scheduleHunterReply = useCallback(
    (engagementId: string) => {
      setTypingIds((current) =>
        current.includes(engagementId) ? current : [...current, engagementId],
      );
      window.setTimeout(() => {
        setTypingIds((current) => current.filter((id) => id !== engagementId));
        const engagement = latest.current.engagements.find((item) => item.id === engagementId);
        const task = engagement && BOARD_TASK_BY_ID.get(engagement.taskId);
        const hunter = task && HUNTER_BY_ID.get(task.hunterId);
        if (!engagement || !task || !hunter) return;
        const reply = hunterReply(
          task,
          hunter,
          engagement,
          hasAssessmentIn(latest.current.assessments, task.requiredAssessmentId),
        );
        if (!reply) return;
        const messages: ChatMessage[] = [
          { id: uid("m"), sender: "hunter", body: reply.body, at: nowIso() },
        ];
        if (reply.connect) {
          messages.push({
            id: uid("m"),
            sender: "system",
            body: `${hunter.name} accepted your inquiry. You are now connected to ${task.title}.`,
            at: nowIso(),
          });
        }
        patchEngagement(engagementId, (item) => ({
          ...item,
          status: reply.status ?? item.status,
          stage: reply.stage ?? item.stage,
          replies: reply.hold ? item.replies : item.replies + 1,
          unread: item.unread + messages.length,
          messages: [...item.messages, ...messages],
        }));
        notify(
          "message",
          `${hunter.name} replied`,
          reply.body.slice(0, 110),
          `/marketplace/messages?thread=${engagementId}`,
        );
        if (reply.connect) window.setTimeout(() => assignFirstBatch(engagementId), ASSIGN_DELAY_MS);
      }, REPLY_DELAY_MS);
    },
    [assignFirstBatch, notify, patchEngagement],
  );

  const value = useMemo<WorkspaceValue>(() => {
    const appendMessage = (engagementId: string, sender: ChatMessage["sender"], body: string) =>
      patchEngagement(engagementId, (engagement) => ({
        ...engagement,
        messages: [...engagement.messages, { id: uid("m"), sender, body, at: nowIso() }],
      }));

    const patchApplication = (id: string, update: (item: BidderApplication) => BidderApplication) =>
      setApplications((current) => current.map((item) => (item.id === id ? update(item) : item)));

    const patchReview = (id: string, update: (item: Review) => Review) =>
      setReviews((current) => current.map((item) => (item.id === id ? update(item) : item)));

    return {
      profile,
      engagements,
      invitations,
      interviews,
      assignments,
      applications,
      reviews,
      notifications,
      assessments,
      transactions,
      payouts,
      savedTaskIds,
      typingIds,
      unreadMessages: engagements.reduce((sum, item) => sum + item.unread, 0),
      unreadNotifications: notifications.filter((item) => !item.read).length,
      engagementForTask: (taskId) =>
        engagements.find(
          (item) =>
            item.taskId === taskId && item.status !== "withdrawn" && item.status !== "declined",
        ),
      hasAssessment,
      toggleSaved: (taskId) =>
        setSavedTaskIds((current) =>
          current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
        ),

      contactTask: ({ taskId, pitch, weeklyCapacity, proposedRates }) => {
        const task = BOARD_TASK_BY_ID.get(taskId);
        if (!task) return { ok: false, error: "This task is no longer on the board." };
        if (task.status === "closed") return { ok: false, error: "This task is closed." };
        if (!pitch.trim()) return { ok: false, error: "Write a short message to the job hunter." };
        if (
          engagements.some(
            (item) =>
              item.taskId === taskId && item.status !== "withdrawn" && item.status !== "declined",
          )
        ) {
          return { ok: false, error: "You already have a conversation for this task." };
        }
        const id = uid("eng");
        const at = nowIso();
        setEngagements((current) => [
          {
            id,
            taskId,
            status: "contacted",
            stage: "inquiry",
            pitch: pitch.trim(),
            proposedRates,
            weeklyCapacity,
            createdAt: at,
            unread: 0,
            replies: 0,
            messages: [{ id: uid("m"), sender: "bidder", body: pitch.trim(), at }],
          },
          ...current,
        ]);
        scheduleHunterReply(id);
        return { ok: true, id };
      },

      sendMessage: (engagementId, body) => {
        const text = body.trim();
        if (!text) return;
        appendMessage(engagementId, "bidder", text);
        scheduleHunterReply(engagementId);
      },

      markRead: (engagementId) =>
        patchEngagement(engagementId, (engagement) => ({ ...engagement, unread: 0 })),

      withdrawEngagement: (engagementId) => {
        patchEngagement(engagementId, (engagement) => ({
          ...engagement,
          status: "withdrawn",
          stage: "declined",
          messages: [
            ...engagement.messages,
            { id: uid("m"), sender: "system", body: "You withdrew this inquiry.", at: nowIso() },
          ],
        }));
      },

      proposeRates: (engagementId, rates) => {
        patchEngagement(engagementId, (engagement) => ({ ...engagement, proposedRates: rates }));
        const summary = rates
          .map(
            (rate) =>
              `${PACKAGE_BY_ID.get(rate.packageId)?.name ?? rate.packageId} $${rate.rate.toFixed(2)}`,
          )
          .join(", ");
        appendMessage(engagementId, "bidder", `I'd like to propose these rates: ${summary}.`);
        scheduleHunterReply(engagementId);
      },

      respondInvitation: (invitationId, decision) => {
        const invitation = invitations.find((item) => item.id === invitationId);
        const task = invitation && BOARD_TASK_BY_ID.get(invitation.taskId);
        const hunter = task && HUNTER_BY_ID.get(task.hunterId);
        if (!invitation || !task || !hunter) return { ok: false, error: "Invitation not found." };
        if (decision === "decline") {
          setInvitations((current) =>
            current.map((item) =>
              item.id === invitationId ? { ...item, status: "declined" } : item,
            ),
          );
          return { ok: true };
        }
        if (!hasAssessment(task.requiredAssessmentId)) {
          return {
            ok: false,
            error: "Pass the required assessment before accepting this invitation.",
          };
        }
        const id = uid("eng");
        const at = nowIso();
        const line = task.packageLines[0];
        setInvitations((current) =>
          current.map((item) =>
            item.id === invitationId ? { ...item, status: "accepted" } : item,
          ),
        );
        setEngagements((current) => [
          {
            id,
            taskId: task.id,
            status: "negotiating",
            stage: "screening",
            pitch: invitation.message,
            proposedRates: [{ packageId: line.packageId, rate: invitation.offeredRate }],
            weeklyCapacity: profile.weeklyCapacity,
            createdAt: at,
            unread: 0,
            replies: 1,
            messages: [
              { id: uid("m"), sender: "hunter", body: invitation.message, at: invitation.sentAt },
              { id: uid("m"), sender: "system", body: "You accepted the invitation.", at },
              {
                id: uid("m"),
                sender: "bidder",
                body: `Thanks ${hunter.name.split(" ")[0]}, I'm happy to take this at $${invitation.offeredRate.toFixed(2)} per link.`,
                at,
              },
            ],
          },
          ...current,
        ]);
        scheduleHunterReply(id);
        return { ok: true, id };
      },

      cancelInterview: (interviewId) =>
        setInterviews((current) =>
          current.map((item) =>
            item.id === interviewId ? { ...item, status: "cancelled" } : item,
          ),
        ),

      rescheduleInterview: (interviewId, date, start) => {
        const interview = interviews.find((item) => item.id === interviewId);
        setInterviews((current) =>
          current.map((item) => (item.id === interviewId ? { ...item, date, start } : item)),
        );
        if (interview) {
          appendMessage(
            interview.engagementId,
            "bidder",
            `Could we move our call to ${date} at ${start}? Let me know if that doesn't work.`,
          );
        }
      },

      startApplication: (applicationId) =>
        patchApplication(applicationId, (item) =>
          item.status === "queued" ? { ...item, status: "in_progress", updatedAt: nowIso() } : item,
        ),

      submitApplication: (applicationId, input) => {
        if (!input.confirmation.trim()) {
          return {
            ok: false,
            error: "Add the confirmation number or page title from the employer.",
          };
        }
        if (!(input.minutesSpent > 0)) return { ok: false, error: "Enter the minutes you spent." };
        const application = applications.find((item) => item.id === applicationId);
        patchApplication(applicationId, (item) => ({
          ...item,
          status: "submitted",
          updatedAt: nowIso(),
          minutesSpent: input.minutesSpent,
          confirmation: input.confirmation.trim(),
          evidenceNote: input.evidenceNote.trim() || undefined,
          issue: undefined,
        }));
        if (application?.status === "returned") {
          setReviews((current) =>
            current.map((review) =>
              review.applicationId === applicationId
                ? {
                    ...review,
                    resolution: "fixed",
                    thread: [
                      ...review.thread,
                      {
                        id: uid("rc"),
                        sender: "bidder",
                        body: "I've corrected this and resubmitted with fresh evidence. Please re-check when you can.",
                        at: nowIso(),
                      },
                    ],
                  }
                : review,
            ),
          );
        }
        return { ok: true };
      },

      askHunter: (applicationId, question) => {
        const application = applications.find((item) => item.id === applicationId);
        const assignment = assignments.find((item) => item.id === application?.assignmentId);
        if (!application || !assignment || !question.trim()) return;
        const job = POOL_JOBS.find((item) => item.id === application.jobId);
        appendMessage(
          assignment.engagementId,
          "bidder",
          `Question about ${job?.company ?? "a link"} (${job?.title ?? application.jobId}): ${question.trim()}`,
        );
        patchApplication(applicationId, (item) => ({ ...item, issue: question.trim() }));
        scheduleHunterReply(assignment.engagementId);
      },

      replyToReview: (reviewId, body) => {
        if (!body.trim()) return;
        patchReview(reviewId, (review) => ({
          ...review,
          thread: [
            ...review.thread,
            { id: uid("rc"), sender: "bidder", body: body.trim(), at: nowIso() },
          ],
        }));
      },

      acknowledgeReview: (reviewId) =>
        patchReview(reviewId, (review) => ({
          ...review,
          resolution:
            review.verdict === "mistake" || review.verdict === "warning"
              ? "acknowledged"
              : "closed",
        })),

      disputeReview: (reviewId, reason) => {
        if (!reason.trim()) return;
        patchReview(reviewId, (review) => ({
          ...review,
          resolution: "disputed",
          thread: [
            ...review.thread,
            {
              id: uid("rc"),
              sender: "bidder",
              body: `I'd like to dispute this: ${reason.trim()}`,
              at: nowIso(),
            },
          ],
        }));
        notify(
          "review",
          "Dispute sent",
          "OpenSeat support will review this decision within one business day.",
          "/marketplace/candidate/feedback",
        );
      },

      requestEarlyPayout: (amount) => {
        const available = Math.max(
          0,
          sumNet(payouts.filter((payout) => payout.status === "processing")) -
            transactions
              .filter((item) => item.id.startsWith("wt-new"))
              .reduce((sum, item) => sum - item.amount, 0),
        );
        if (!(amount >= MIN_EARLY_PAYOUT)) {
          return { ok: false, error: `The minimum early payout is $${MIN_EARLY_PAYOUT}.` };
        }
        if (amount > available + 0.001) {
          return { ok: false, error: "That is more than your available balance." };
        }
        setTransactions((current) => [
          {
            id: uid("wt-new"),
            kind: "withdrawal",
            label: `Early payout to ${profile.payoutMethod.split("·")[1]?.trim() ?? "your account"}`,
            amount: -amount,
            at: nowIso(),
          },
          ...current,
        ]);
        notify(
          "payout",
          "Early payout requested",
          `$${amount.toFixed(2)} is on its way to your account.`,
          "/marketplace/candidate/earnings",
        );
        return { ok: true };
      },

      updateProfile: (patch) => setProfile((current) => ({ ...current, ...patch })),

      submitAssessment: (assessmentId, answers) => {
        const quiz = ASSESSMENT_QUIZ[assessmentId] ?? [];
        const correct = quiz.filter((question, index) => answers[index] === question.answer).length;
        const score = quiz.length ? Math.round((correct / quiz.length) * 100) : 0;
        const passed = score >= PASS_MARK;
        setAssessments((current) =>
          current.map((item) =>
            item.id === assessmentId
              ? { ...item, status: passed ? "passed" : "failed", score, takenAt: nowIso() }
              : item,
          ),
        );
        if (passed) {
          notify(
            "system",
            "Assessment passed",
            `You scored ${score}%. New tasks are now unlocked.`,
            "/marketplace/candidate/tests",
          );
        }
        return { score, passed };
      },

      markNotificationRead: (id) =>
        setNotifications((current) =>
          current.map((item) => (item.id === id ? { ...item, read: true } : item)),
        ),
      markAllNotificationsRead: () =>
        setNotifications((current) => current.map((item) => ({ ...item, read: true }))),
    };
  }, [
    profile,
    engagements,
    invitations,
    interviews,
    assignments,
    applications,
    reviews,
    notifications,
    assessments,
    transactions,
    payouts,
    savedTaskIds,
    typingIds,
    hasAssessment,
    notify,
    patchEngagement,
    scheduleHunterReply,
  ]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function hasAssessmentIn(assessments: Assessment[], assessmentId?: string) {
  return (
    !assessmentId ||
    assessments.some(
      (assessment) => assessment.id === assessmentId && assessment.status === "passed",
    )
  );
}

export function useBidderWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("useBidderWorkspace must be used within BidderWorkspaceProvider.");
  return context;
}
