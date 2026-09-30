import type {
  ApplicationStatus,
  InquiryStatus,
  InvoiceStatus,
  TaskStatus,
  TaskType,
} from "@/src/shared/types/marketplace";

import { Badge } from "@/src/shared/marketplace-ui";

type BadgeTone = "neutral" | "info" | "success" | "warning" | "error" | "purple";

const TASK_STATUS: Record<TaskStatus, [string, BadgeTone]> = {
  draft: ["Draft", "neutral"],
  open: ["Open for bidders", "info"],
  in_progress: ["In progress", "success"],
  paused: ["Paused", "warning"],
  completed: ["Completed", "neutral"],
};

const APPLICATION_STATUS: Record<ApplicationStatus, [string, BadgeTone]> = {
  queued: ["Queued", "neutral"],
  in_progress: ["In progress", "info"],
  submitted: ["Needs QA", "warning"],
  qa_passed: ["QA passed", "success"],
  returned: ["Returned", "error"],
  failed: ["Failed", "error"],
};

const INQUIRY_STATUS: Record<InquiryStatus, [string, BadgeTone]> = {
  new: ["New", "info"],
  negotiating: ["Negotiating", "warning"],
  connected: ["Connected", "success"],
  declined: ["Declined", "neutral"],
};

const INVOICE_STATUS: Record<InvoiceStatus, [string, BadgeTone]> = {
  open: ["Due", "warning"],
  overdue: ["Overdue", "error"],
  paid: ["Paid", "success"],
};

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  permanent: "Permanent contract",
  one_time: "One-time batch",
};
export const APPLICATION_STATUS_LABEL = Object.fromEntries(
  Object.entries(APPLICATION_STATUS).map(([key, [label]]) => [key, label]),
) as Record<ApplicationStatus, string>;

export const TaskStatusBadge = ({ status }: { status: TaskStatus }) => (
  <Badge label={TASK_STATUS[status][0]} tone={TASK_STATUS[status][1]} />
);
export const ApplicationStatusBadge = ({ status }: { status: ApplicationStatus }) => (
  <Badge label={APPLICATION_STATUS[status][0]} tone={APPLICATION_STATUS[status][1]} />
);
export const InquiryStatusBadge = ({ status }: { status: InquiryStatus }) => (
  <Badge label={INQUIRY_STATUS[status][0]} tone={INQUIRY_STATUS[status][1]} />
);
export const InvoiceStatusBadge = ({ status }: { status: InvoiceStatus }) => (
  <Badge label={INVOICE_STATUS[status][0]} tone={INVOICE_STATUS[status][1]} />
);
export const TaskTypeBadge = ({ type }: { type: TaskType }) => (
  <Badge label={TASK_TYPE_LABEL[type]} tone={type === "permanent" ? "purple" : "neutral"} />
);
