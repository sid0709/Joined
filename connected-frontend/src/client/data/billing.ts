import type {
  HunterProfile,
  Invoice,
  InvoiceLine,
  Transaction,
} from "@/src/shared/types/marketplace";

import { INITIAL_APPLICATIONS, INITIAL_ASSIGNMENTS } from "@/src/client/data/operations";
import { INITIAL_TASKS } from "@/src/client/data/tasks";
import { isoAgo, MOCK_NOW, MS_PER_DAY } from "@/src/shared/mock/clock";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";

interface InvoiceWindow {
  invoice: Invoice;
  fromDaysAgo: number;
  toDaysAgo: number;
}

/** Weekly invoices. Every QA-passed link inside the window is billable at the task rate. */
const WINDOWS: InvoiceWindow[] = [
  {
    invoice: {
      id: "inv-0038",
      number: "INV-2026-0038",
      period: "Sep 21 – Sep 27",
      issuedAt: isoAgo(1),
      dueAt: isoAgo(-6),
      status: "open",
    },
    fromDaysAgo: 7,
    toDaysAgo: 0,
  },
  {
    invoice: {
      id: "inv-0037",
      number: "INV-2026-0037",
      period: "Sep 14 – Sep 20",
      issuedAt: isoAgo(8),
      dueAt: isoAgo(1),
      status: "overdue",
    },
    fromDaysAgo: 14,
    toDaysAgo: 7,
  },
  {
    invoice: {
      id: "inv-0036",
      number: "INV-2026-0036",
      period: "Sep 7 – Sep 13",
      issuedAt: isoAgo(15),
      dueAt: isoAgo(8),
      status: "paid",
      paidAt: isoAgo(9),
    },
    fromDaysAgo: 21,
    toDaysAgo: 14,
  },
  {
    invoice: {
      id: "inv-0035",
      number: "INV-2026-0035",
      period: "Aug 31 – Sep 6",
      issuedAt: isoAgo(22),
      dueAt: isoAgo(15),
      status: "paid",
      paidAt: isoAgo(17),
    },
    fromDaysAgo: 28,
    toDaysAgo: 21,
  },
  {
    invoice: {
      id: "inv-0034",
      number: "INV-2026-0034",
      period: "Aug 24 – Aug 30",
      issuedAt: isoAgo(29),
      dueAt: isoAgo(22),
      status: "paid",
      paidAt: isoAgo(24),
    },
    fromDaysAgo: 35,
    toDaysAgo: 28,
  },
];

function buildLines(): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  for (const { invoice, fromDaysAgo, toDaysAgo } of WINDOWS) {
    const from = MOCK_NOW.getTime() - fromDaysAgo * MS_PER_DAY;
    const to = MOCK_NOW.getTime() - toDaysAgo * MS_PER_DAY;
    for (const assignment of INITIAL_ASSIGNMENTS) {
      const links = INITIAL_APPLICATIONS.filter((application) => {
        const at = new Date(application.updatedAt).getTime();
        return (
          application.assignmentId === assignment.id &&
          application.status === "qa_passed" &&
          at >= from &&
          at < to
        );
      }).length;
      if (!links) continue;
      const task = INITIAL_TASKS.find((item) => item.id === assignment.taskId);
      const rate =
        task?.packageLines.find((line) => line.packageId === assignment.packageId)?.rate ??
        PACKAGE_BY_ID.get(assignment.packageId)?.ratePerLink ??
        0;
      lines.push({
        id: `${invoice.id}-${assignment.id}`,
        invoiceId: invoice.id,
        assignmentId: assignment.id,
        taskId: assignment.taskId,
        bidderId: assignment.bidderId,
        packageId: assignment.packageId,
        links,
        rate,
      });
    }
  }
  return lines;
}

export const INITIAL_INVOICES: Invoice[] = WINDOWS.map((window) => window.invoice);
export const INITIAL_INVOICE_LINES: InvoiceLine[] = buildLines();

const invoiceTotal = (invoiceId: string) =>
  INITIAL_INVOICE_LINES.filter((line) => line.invoiceId === invoiceId).reduce(
    (sum, line) => sum + line.links * line.rate,
    0,
  );

const round2 = (value: number) => Math.round(value * 100) / 100;

export const INITIAL_TRANSACTIONS: Transaction[] = (
  [
    {
      id: "txn-deposit-1",
      kind: "deposit",
      label: "Wallet top-up · Visa ending 4417",
      amount: 600,
      at: isoAgo(34),
    },
    ...INITIAL_INVOICES.filter((invoice) => invoice.status === "paid" && invoice.paidAt).map(
      (invoice) => ({
        id: `txn-${invoice.id}`,
        kind: "payout" as const,
        label: `${invoice.number} · paid to bidders`,
        amount: -round2(invoiceTotal(invoice.id)),
        at: invoice.paidAt as string,
      }),
    ),
    {
      id: "txn-deposit-2",
      kind: "deposit",
      label: "Wallet top-up · Visa ending 4417",
      amount: 400,
      at: isoAgo(17),
    },
    {
      id: "txn-refund-1",
      kind: "refund",
      label: "Refund · returned application not re-submitted",
      amount: 3.7,
      at: isoAgo(6),
    },
  ] as Transaction[]
).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

export const INITIAL_PROFILE: HunterProfile = {
  name: "Avery Morgan",
  company: "Morgan Career Partners",
  headline:
    "Career coach placing product and operations leaders. I hire bidders for steady weekly application coverage.",
  website: "https://morgancareer.example.com",
  balance: 420,
  autoTopUp: false,
  availability: {
    days: [1, 2, 3, 4, 5],
    startHour: 9,
    endHour: 17,
    defaultDurationMin: 30,
    bufferMin: 15,
    timezone: "Eastern Time (ET)",
    meetingLink: "https://meet.morgancareer.example.com/interviews",
  },
  notifications: {
    inquiries: true,
    interviews: true,
    qa: true,
    billing: true,
    weeklyDigest: false,
  },
};
