import { useMemo } from "react";

import { useHunter } from "@/src/client/context/HunterContext";
import { MOCK_NOW } from "@/src/client/data/clock";
import { dayKey } from "@/src/client/lib/format";
import {
  countStatuses,
  dailySeries,
  deliveredCount,
  groupBy,
  qaRate,
  sumLines,
} from "@/src/client/lib/selectors";

const TREND_DAYS = 14;
const WEEK = 7;

/** Every derived number the dashboard, monitoring, and task pages share. */
export function useHunterMetrics() {
  const { tasks, inquiries, applications, assignments, invoices, invoiceLines, bidders, packages } =
    useHunter();

  return useMemo(() => {
    const liveTasks = tasks.filter((task) => task.status === "in_progress");
    const dailyTarget = liveTasks.reduce((sum, task) => sum + task.dailyTarget, 0);
    const daily = dailySeries(applications, TREND_DAYS, dailyTarget);
    const counts = countStatuses(applications);
    const today = dayKey(MOCK_NOW);
    const todayPoint = daily.find((point) => point.date === today);
    const thisWeek = daily.slice(-WEEK).reduce((sum, point) => sum + point.submitted, 0);
    const lastWeek = daily
      .slice(0, TREND_DAYS - WEEK)
      .reduce((sum, point) => sum + point.submitted, 0);

    const connectedByTask = groupBy(
      inquiries.filter((item) => item.status === "connected"),
      (item) => item.taskId,
    );
    const pendingInquiries = inquiries.filter(
      (item) => item.status === "new" || item.status === "negotiating",
    );
    const unreadMessages = inquiries.reduce((sum, item) => sum + item.unread, 0);
    const awaitingReview = applications.filter((application) => application.status === "submitted");

    const taskRows = tasks.map((task) => {
      const taskApps = applications.filter((application) => application.taskId === task.id);
      const taskCounts = countStatuses(taskApps);
      const connected = inquiries.filter(
        (item) => item.taskId === task.id && item.status === "connected",
      );
      const pending = inquiries.filter(
        (item) =>
          item.taskId === task.id && (item.status === "new" || item.status === "negotiating"),
      );
      return {
        task,
        counts: taskCounts,
        assigned: taskApps.length,
        delivered: deliveredCount(taskCounts),
        connected,
        pending,
        applications: taskApps,
      };
    });

    const bidderIds = new Set(
      inquiries.filter((item) => item.status === "connected").map((item) => item.bidderId),
    );
    const bidderRows = bidders
      .filter((bidder) => bidderIds.has(bidder.id))
      .map((bidder) => {
        const own = applications.filter((application) => application.bidderId === bidder.id);
        const ownCounts = countStatuses(own);
        const ownAssignments = assignments.filter(
          (assignment) => assignment.bidderId === bidder.id,
        );
        const activeAssignments = ownAssignments.filter(
          (assignment) => assignment.status === "active",
        );
        const week = daily
          .slice(-WEEK)
          .map(
            (point) =>
              own.filter(
                (application) =>
                  dayKey(application.updatedAt) === point.date &&
                  ["submitted", "qa_passed", "returned"].includes(application.status),
              ).length,
          );
        const minutes = own
          .filter((application) => application.minutesSpent)
          .map((application) => application.minutesSpent as number);
        const avgMinutes = minutes.length
          ? minutes.reduce((sum, value) => sum + value, 0) / minutes.length
          : 0;
        const target = tasks
          .filter(
            (task) =>
              task.status === "in_progress" &&
              inquiries.some(
                (item) =>
                  item.taskId === task.id &&
                  item.bidderId === bidder.id &&
                  item.status === "connected",
              ),
          )
          .reduce(
            (sum, task) =>
              sum +
              Math.ceil(task.dailyTarget / Math.max(1, connectedByTask.get(task.id)?.length ?? 1)),
            0,
          );
        const lastActive = own.length
          ? Math.max(...own.map((application) => new Date(application.updatedAt).getTime()))
          : 0;
        return {
          bidder,
          counts: ownCounts,
          delivered: deliveredCount(ownCounts),
          assignments: ownAssignments,
          activeAssignments,
          week,
          today: week[week.length - 1] ?? 0,
          target,
          avgMinutes,
          qa: qaRate(ownCounts),
          lastActive: lastActive ? new Date(lastActive).toISOString() : undefined,
        };
      });

    const packageRows = packages.map((tier) => {
      const own = applications.filter((application) => application.packageId === tier.id);
      const ownCounts = countStatuses(own);
      const cost =
        own.filter((application) => application.status === "qa_passed").length * tier.ratePerLink;
      return {
        tier,
        counts: ownCounts,
        total: own.length,
        delivered: deliveredCount(ownCounts),
        cost,
      };
    });

    const outstanding = invoices
      .filter((invoice) => invoice.status !== "paid")
      .reduce(
        (sum, invoice) =>
          sum + sumLines(invoiceLines.filter((line) => line.invoiceId === invoice.id)),
        0,
      );
    const trend = daily.map((point) => point.submitted);

    return {
      liveTasks,
      daily,
      dailyTarget,
      counts,
      todayDelivered: todayPoint?.submitted ?? 0,
      thisWeek,
      lastWeek,
      trend,
      pendingInquiries,
      unreadMessages,
      awaitingReview,
      taskRows,
      bidderRows,
      packageRows,
      outstanding,
      qa: qaRate(counts),
      delivered: deliveredCount(counts),
    };
  }, [tasks, inquiries, applications, assignments, invoices, invoiceLines, bidders, packages]);
}
