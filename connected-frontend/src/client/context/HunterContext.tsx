"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type {
  ApplicationRecord,
  Assignment,
  Bidder,
  ChatMessage,
  Feedback,
  HiringStage,
  HunterNotification,
  HunterProfile,
  Inquiry,
  Interview,
  InterviewOutcome,
  Invoice,
  InvoiceLine,
  PackageTier,
  PoolJob,
  Task,
  Transaction,
} from "@/src/shared/types/marketplace";

import { BIDDERS } from "@/src/client/data/bidders";
import {
  INITIAL_INVOICE_LINES,
  INITIAL_INVOICES,
  INITIAL_PROFILE,
  INITIAL_TRANSACTIONS,
} from "@/src/client/data/billing";
import { INITIAL_INQUIRIES } from "@/src/client/data/inquiries";
import { INITIAL_INTERVIEWS } from "@/src/client/data/interviews";
import { INITIAL_NOTIFICATIONS } from "@/src/client/data/notifications";
import {
  INITIAL_APPLICATIONS,
  INITIAL_ASSIGNMENTS,
  INITIAL_FEEDBACK,
} from "@/src/client/data/operations";
import { NEXT_STAGE, STAGE_TITLE, STATUS_FOR_STAGE } from "@/src/client/data/pipeline";
import { INITIAL_TASKS } from "@/src/client/data/tasks";
import { sumLines } from "@/src/shared/lib/selectors";
import { MOCK_NOW } from "@/src/shared/mock/clock";
import { PACKAGE_BY_ID, PACKAGE_TIERS } from "@/src/shared/mock/packages";
import { POOL_JOBS } from "@/src/shared/mock/pool";

interface ActionResult {
  ok: boolean;
  error?: string;
}

export type NewTaskInput = Omit<Task, "id" | "postedAt" | "views" | "startsAt"> & {
  startsAt?: string;
};

export interface AssignJobsInput {
  taskId: string;
  bidderId: string;
  packageId: string;
  jobIds: string[];
  dueAt: string;
  note: string;
}

export interface ScheduleInterviewInput {
  inquiryId: string;
  date: string;
  start: string;
  durationMin: number;
  mode: Interview["mode"];
  link?: string;
  notes: string;
}

interface HunterContextValue {
  profile: HunterProfile;
  tasks: Task[];
  packages: PackageTier[];
  bidders: Bidder[];
  inquiries: Inquiry[];
  interviews: Interview[];
  poolJobs: PoolJob[];
  /** jobId → assignmentId for every pool link that has already been handed to a bidder. */
  assignedJobs: Map<string, string>;
  assignments: Assignment[];
  applications: ApplicationRecord[];
  feedback: Feedback[];
  invoices: Invoice[];
  invoiceLines: InvoiceLine[];
  transactions: Transaction[];
  notifications: HunterNotification[];
  bidderById: (id: string) => Bidder | undefined;
  taskById: (id: string) => Task | undefined;
  createTask: (input: NewTaskInput) => string;
  setTaskStatus: (taskId: string, status: Task["status"]) => void;
  updateProfile: (patch: Partial<HunterProfile>) => void;
  /** Moves a bidder to a hiring stage. Connecting checks the task's bidder slots. */
  moveInquiry: (inquiryId: string, stage: HiringStage) => ActionResult;
  /** Applies a drag-and-drop result from the pipeline board, keeping card order. */
  applyPipeline: (order: { id: string; stage: HiringStage }[]) => void;
  saveInquiryNotes: (inquiryId: string, notes: string, score?: number) => void;
  scheduleInterview: (input: ScheduleInterviewInput) => ActionResult;
  rescheduleInterview: (
    interviewId: string,
    patch: Pick<ScheduleInterviewInput, "date" | "start" | "durationMin">,
  ) => void;
  cancelInterview: (interviewId: string) => void;
  recordInterview: (
    interviewId: string,
    result: {
      status: "completed" | "no_show";
      outcome?: InterviewOutcome;
      score?: number;
      notes: string;
    },
  ) => void;
  respondToInquiry: (inquiryId: string, decision: "accept" | "decline") => ActionResult;
  sendOffer: (inquiryId: string, packageId: string, rate: number) => void;
  sendMessage: (inquiryId: string, body: string) => void;
  markInquiryRead: (inquiryId: string) => void;
  assignJobs: (input: AssignJobsInput) => ActionResult & { assignmentId?: string };
  reviewApplications: (ids: string[], decision: "approve" | "return", note?: string) => void;
  sendFeedback: (input: Omit<Feedback, "id" | "at">) => void;
  payInvoice: (invoiceId: string) => ActionResult;
  topUp: (amount: number) => void;
  markNotificationRead: (id?: string) => void;
}

const HunterContext = createContext<HunterContextValue | undefined>(undefined);

const nowIso = () => MOCK_NOW.toISOString();
let serial = 0;
const nextId = (prefix: string) => `${prefix}-${(serial += 1)}-${Date.now().toString(36)}`;

export function HunterProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [inquiries, setInquiries] = useState(() =>
    INITIAL_INQUIRIES.map((item) => ({ ...item, status: STATUS_FOR_STAGE[item.stage] })),
  );
  const [interviews, setInterviews] = useState(INITIAL_INTERVIEWS);
  const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS);
  const [applications, setApplications] = useState(INITIAL_APPLICATIONS);
  const [feedback, setFeedback] = useState(INITIAL_FEEDBACK);
  const [invoices, setInvoices] = useState(INITIAL_INVOICES);
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const invoiceLines = INITIAL_INVOICE_LINES;

  const assignedJobs = useMemo(() => {
    const map = new Map<string, string>();
    for (const assignment of assignments)
      for (const jobId of assignment.jobIds) map.set(jobId, assignment.id);
    return map;
  }, [assignments]);

  const bidderById = useCallback((id: string) => BIDDERS.find((bidder) => bidder.id === id), []);
  const taskById = useCallback((id: string) => tasks.find((task) => task.id === id), [tasks]);

  const createTask = (input: NewTaskInput) => {
    const id = nextId("task");
    setTasks((current) => [
      { ...input, id, postedAt: nowIso(), startsAt: input.startsAt ?? nowIso(), views: 0 },
      ...current,
    ]);
    return id;
  };

  const setTaskStatus = (taskId: string, status: Task["status"]) =>
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status } : task)));

  const updateProfile = (patch: Partial<HunterProfile>) =>
    setProfile((current) => ({ ...current, ...patch }));

  const stageMessage = (
    bidderName: string,
    stage: HiringStage,
    taskTitle: string,
  ): ChatMessage => ({
    id: nextId("msg"),
    sender: "system",
    body:
      stage === "connected"
        ? `Inquiry accepted. ${bidderName} is now connected to ${taskTitle}.`
        : stage === "declined"
          ? "Inquiry declined."
          : `Moved to ${STAGE_TITLE[stage]}.`,
    at: nowIso(),
  });

  const advanced = (item: Inquiry, stage: HiringStage): Inquiry => {
    const bidder = BIDDERS.find((candidate) => candidate.id === item.bidderId);
    const task = tasks.find((candidate) => candidate.id === item.taskId);
    return {
      ...item,
      stage,
      status: STATUS_FOR_STAGE[stage],
      unread: stage === "connected" || stage === "declined" ? 0 : item.unread,
      messages: [
        ...item.messages,
        stageMessage(bidder?.name ?? "Bidder", stage, task?.title ?? "the task"),
      ],
    };
  };

  const moveInquiry = (inquiryId: string, stage: HiringStage): ActionResult => {
    const inquiry = inquiries.find((item) => item.id === inquiryId);
    const task = inquiry && tasks.find((item) => item.id === inquiry.taskId);
    if (!inquiry || !task) return { ok: false, error: "Bidder not found." };
    if (inquiry.stage === stage) return { ok: true };
    if (stage === "connected") {
      const connected = inquiries.filter(
        (item) => item.taskId === task.id && item.stage === "connected" && item.id !== inquiryId,
      ).length;
      if (connected >= task.bidderSlots)
        return {
          ok: false,
          error: `All ${task.bidderSlots} bidder slots on ${task.title} are filled. Raise the slot count or decline someone first.`,
        };
    }
    setInquiries((current) =>
      current.map((item) => (item.id === inquiryId ? advanced(item, stage) : item)),
    );
    if (stage === "connected" && task.status === "open") setTaskStatus(task.id, "in_progress");
    return { ok: true };
  };

  const applyPipeline = (order: { id: string; stage: HiringStage }[]) =>
    setInquiries((current) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      const placed = order.flatMap(({ id, stage }) => {
        const item = byId.get(id);
        if (!item) return [];
        return [item.stage === stage ? item : advanced(item, stage)];
      });
      const placedIds = new Set(placed.map((item) => item.id));
      return [...placed, ...current.filter((item) => !placedIds.has(item.id))];
    });

  const saveInquiryNotes = (inquiryId: string, notes: string, score?: number) =>
    setInquiries((current) =>
      current.map((item) =>
        item.id === inquiryId ? { ...item, notes, score: score ?? item.score } : item,
      ),
    );

  const scheduleInterview = (input: ScheduleInterviewInput): ActionResult => {
    const inquiry = inquiries.find((item) => item.id === input.inquiryId);
    if (!inquiry) return { ok: false, error: "Choose a bidder first." };
    if (
      interviews.some(
        (item) =>
          item.status === "scheduled" && item.date === input.date && item.start === input.start,
      )
    ) {
      return { ok: false, error: "You already have an interview at that time. Pick another slot." };
    }
    setInterviews((current) => [...current, { id: nextId("iv"), status: "scheduled", ...input }]);
    if (inquiry.stage === "inquiry" || inquiry.stage === "screening")
      moveInquiry(inquiry.id, "interview");
    return { ok: true };
  };

  const rescheduleInterview = (
    interviewId: string,
    patch: Pick<ScheduleInterviewInput, "date" | "start" | "durationMin">,
  ) =>
    setInterviews((current) =>
      current.map((item) =>
        item.id === interviewId ? { ...item, ...patch, status: "scheduled" } : item,
      ),
    );

  const cancelInterview = (interviewId: string) =>
    setInterviews((current) =>
      current.map((item) => (item.id === interviewId ? { ...item, status: "cancelled" } : item)),
    );

  const recordInterview = (
    interviewId: string,
    result: {
      status: "completed" | "no_show";
      outcome?: InterviewOutcome;
      score?: number;
      notes: string;
    },
  ) => {
    const interview = interviews.find((item) => item.id === interviewId);
    const inquiry = interview && inquiries.find((item) => item.id === interview.inquiryId);
    if (!interview || !inquiry) return;
    setInterviews((current) =>
      current.map((item) => (item.id === interviewId ? { ...item, ...result } : item)),
    );
    if (result.score) saveInquiryNotes(inquiry.id, inquiry.notes, result.score);
    if (result.status !== "completed") return;
    if (result.outcome === "advance" && inquiry.stage === "interview")
      moveInquiry(inquiry.id, NEXT_STAGE.interview ?? "trial");
    if (result.outcome === "reject") moveInquiry(inquiry.id, "declined");
  };

  const respondToInquiry = (inquiryId: string, decision: "accept" | "decline"): ActionResult =>
    moveInquiry(inquiryId, decision === "accept" ? "connected" : "declined");

  const sendOffer = (inquiryId: string, packageId: string, rate: number) =>
    setInquiries((current) =>
      current.map((item) =>
        item.id === inquiryId
          ? {
              ...item,
              status: item.status === "new" ? "negotiating" : item.status,
              stage: item.stage === "inquiry" ? "screening" : item.stage,
              proposedRates: [
                { packageId, rate },
                ...item.proposedRates.filter((line) => line.packageId !== packageId),
              ],
              messages: [
                ...item.messages,
                {
                  id: nextId("msg"),
                  sender: "hunter",
                  body: `Counter-offer sent: ${PACKAGE_BY_ID.get(packageId)?.name ?? "package"} at $${rate.toFixed(2)} per link.`,
                  at: nowIso(),
                },
              ],
            }
          : item,
      ),
    );

  const sendMessage = (inquiryId: string, body: string) => {
    const text = body.trim();
    if (!text) return;
    setInquiries((current) =>
      current.map((item) =>
        item.id === inquiryId
          ? {
              ...item,
              status: item.status === "new" ? "negotiating" : item.status,
              stage: item.stage === "inquiry" ? "screening" : item.stage,
              unread: 0,
              messages: [
                ...item.messages,
                { id: nextId("msg"), sender: "hunter", body: text, at: nowIso() },
              ],
            }
          : item,
      ),
    );
  };

  const markInquiryRead = (inquiryId: string) =>
    setInquiries((current) =>
      current.map((item) => (item.id === inquiryId && item.unread ? { ...item, unread: 0 } : item)),
    );

  const assignJobs = (input: AssignJobsInput): ActionResult & { assignmentId?: string } => {
    const tier = PACKAGE_BY_ID.get(input.packageId);
    const task = tasks.find((item) => item.id === input.taskId);
    if (!tier || !task) return { ok: false, error: "Choose a task and package first." };
    if (
      !inquiries.some(
        (item) =>
          item.taskId === input.taskId &&
          item.bidderId === input.bidderId &&
          item.status === "connected",
      )
    ) {
      return { ok: false, error: "That bidder is not connected to this task." };
    }
    if (!task.packageLines.some((line) => line.packageId === input.packageId))
      return { ok: false, error: "This package is not part of the selected task." };
    const valid = input.jobIds.filter((jobId) => {
      const job = POOL_JOBS.find((item) => item.id === jobId);
      return job && tier.ats.includes(job.ats) && !assignedJobs.has(jobId);
    });
    if (!valid.length)
      return {
        ok: false,
        error: "None of the selected links match this package or they are already assigned.",
      };

    const assignmentId = nextId("asg");
    setAssignments((current) => [
      {
        id: assignmentId,
        taskId: input.taskId,
        bidderId: input.bidderId,
        packageId: input.packageId,
        jobIds: valid,
        assignedAt: nowIso(),
        dueAt: input.dueAt,
        status: "active",
        note: input.note,
      },
      ...current,
    ]);
    setApplications((current) => [
      ...valid.map((jobId, index) => ({
        id: `app-${assignmentId}-${index + 1}`,
        assignmentId,
        jobId,
        bidderId: input.bidderId,
        packageId: input.packageId,
        taskId: input.taskId,
        status: "queued" as const,
        updatedAt: nowIso(),
      })),
      ...current,
    ]);
    return { ok: true, assignmentId };
  };

  const reviewApplications = (
    ids: string[],
    decision: "approve" | "return",
    note = "Returned for correction",
  ) =>
    setApplications((current) =>
      current.map((application) =>
        ids.includes(application.id) && application.status === "submitted"
          ? {
              ...application,
              status: decision === "approve" ? "qa_passed" : "returned",
              issue: decision === "return" ? note : undefined,
              updatedAt: nowIso(),
            }
          : application,
      ),
    );

  const sendFeedback = (input: Omit<Feedback, "id" | "at">) =>
    setFeedback((current) => [{ ...input, id: nextId("fb"), at: nowIso() }, ...current]);

  const payInvoice = (invoiceId: string): ActionResult => {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice || invoice.status === "paid")
      return { ok: false, error: "This invoice is already paid." };
    const amount = sumLines(invoiceLines.filter((line) => line.invoiceId === invoiceId));
    if (amount > profile.balance)
      return {
        ok: false,
        error: `Wallet balance is short by $${(amount - profile.balance).toFixed(2)}. Add funds to pay ${invoice.number}.`,
      };
    setProfile((current) => ({
      ...current,
      balance: Math.round((current.balance - amount) * 100) / 100,
    }));
    setInvoices((current) =>
      current.map((item) =>
        item.id === invoiceId ? { ...item, status: "paid", paidAt: nowIso() } : item,
      ),
    );
    setTransactions((current) => [
      {
        id: nextId("txn"),
        kind: "payout",
        label: `${invoice.number} · paid to bidders`,
        amount: -amount,
        at: nowIso(),
      },
      ...current,
    ]);
    return { ok: true };
  };

  const topUp = (amount: number) => {
    if (amount <= 0) return;
    setProfile((current) => ({ ...current, balance: current.balance + amount }));
    setTransactions((current) => [
      {
        id: nextId("txn"),
        kind: "deposit",
        label: "Wallet top-up · Visa ending 4417",
        amount,
        at: nowIso(),
      },
      ...current,
    ]);
  };

  const markNotificationRead = (id?: string) =>
    setNotifications((current) =>
      current.map((item) => (!id || item.id === id ? { ...item, read: true } : item)),
    );

  return (
    <HunterContext.Provider
      value={{
        profile,
        tasks,
        packages: PACKAGE_TIERS,
        bidders: BIDDERS,
        inquiries,
        interviews,
        poolJobs: POOL_JOBS,
        assignedJobs,
        assignments,
        applications,
        feedback,
        invoices,
        invoiceLines,
        transactions,
        notifications,
        bidderById,
        taskById,
        createTask,
        setTaskStatus,
        updateProfile,
        moveInquiry,
        applyPipeline,
        saveInquiryNotes,
        scheduleInterview,
        rescheduleInterview,
        cancelInterview,
        recordInterview,
        respondToInquiry,
        sendOffer,
        sendMessage,
        markInquiryRead,
        assignJobs,
        reviewApplications,
        sendFeedback,
        payInvoice,
        topUp,
        markNotificationRead,
      }}
    >
      {children}
    </HunterContext.Provider>
  );
}

export function useHunter() {
  const context = useContext(HunterContext);
  if (!context) throw new Error("useHunter must be used within a HunterProvider.");
  return context;
}
