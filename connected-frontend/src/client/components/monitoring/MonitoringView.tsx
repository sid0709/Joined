"use client";

import { useMemo, useState } from "react";

import { ActivityTab } from "@/src/client/components/monitoring/ActivityTab";
import { BiddersTab, type BidderRow } from "@/src/client/components/monitoring/BiddersTab";
import { FeedbackDialog } from "@/src/client/components/monitoring/FeedbackDialog";
import { FeedbackTab } from "@/src/client/components/monitoring/FeedbackTab";
import { OverviewTab } from "@/src/client/components/monitoring/OverviewTab";
import { PackagesTab, type PackageRow } from "@/src/client/components/monitoring/PackagesTab";
import { ReviewTab } from "@/src/client/components/monitoring/ReviewTab";
import { useHunter } from "@/src/client/context/HunterContext";
import { useHunterMetrics } from "@/src/client/hooks/useHunterMetrics";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { StatCard } from "@/src/shared/kit/StatCard";
import { Tabs } from "@/src/shared/kit/Tabs";
import { dayKey, percent } from "@/src/shared/lib/format";
import { countStatuses, deliveredCount, qaRate } from "@/src/shared/lib/selectors";
import { Button, PageBody, Select } from "@/src/shared/marketplace-ui";
import { MOCK_NOW } from "@/src/shared/mock/clock";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

type TabKey = "overview" | "bidders" | "packages" | "review" | "activity" | "feedback";

export function MonitoringView() {
  const { tasks, applications, packages, bidderById } = useHunter();
  const metrics = useHunterMetrics();
  const [tab, setTab] = useState<TabKey>("overview");
  const [taskFilter, setTaskFilter] = useState("all");
  const [bidderFilter, setBidderFilter] = useState("all");
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);

  const apps = useMemo(
    () =>
      applications.filter(
        (app) =>
          (taskFilter === "all" || app.taskId === taskFilter) &&
          (bidderFilter === "all" || app.bidderId === bidderFilter),
      ),
    [applications, taskFilter, bidderFilter],
  );
  const counts = countStatuses(apps);
  const today = dayKey(MOCK_NOW);
  const deliveredToday = apps.filter(
    (app) =>
      ["submitted", "qa_passed", "returned"].includes(app.status) &&
      dayKey(app.updatedAt) === today,
  ).length;

  const bidderRows: BidderRow[] = metrics.bidderRows
    .filter(
      (row) =>
        (bidderFilter === "all" || row.bidder.id === bidderFilter) &&
        (taskFilter === "all" ||
          row.assignments.some((assignment) => assignment.taskId === taskFilter)),
    )
    .map((row) => {
      const own = apps.filter((app) => app.bidderId === row.bidder.id);
      const ownCounts = countStatuses(own);
      return {
        id: row.bidder.id,
        bidder: row.bidder,
        counts: ownCounts,
        delivered: deliveredCount(ownCounts),
        activeCount: row.activeAssignments.length,
        today: row.today,
        target: row.target,
        qa: qaRate(ownCounts),
        avgMinutes: row.avgMinutes,
        lastActive: row.lastActive,
      };
    });

  const packageRows: PackageRow[] = packages.map((tier) => {
    const own = apps.filter((app) => app.packageId === tier.id);
    const ownCounts = countStatuses(own);
    const minutes = own.flatMap((app) => (app.minutesSpent ? [app.minutesSpent] : []));
    const rate = own.length
      ? (tasks
          .find((task) => task.id === own[0].taskId)
          ?.packageLines.find((line) => line.packageId === tier.id)?.rate ?? tier.ratePerLink)
      : tier.ratePerLink;
    return {
      id: tier.id,
      tier,
      counts: ownCounts,
      total: own.length,
      delivered: deliveredCount(ownCounts),
      avgMinutes: minutes.length
        ? minutes.reduce((sum, value) => sum + value, 0) / minutes.length
        : 0,
      cost: ownCounts.qa_passed * rate,
    };
  });

  const target =
    taskFilter === "all"
      ? metrics.dailyTarget
      : (tasks.find((task) => task.id === taskFilter)?.dailyTarget ?? 0);
  const allMinutes = apps.flatMap((app) => (app.minutesSpent ? [app.minutesSpent] : []));
  const avgMinutes = allMinutes.length
    ? allMinutes.reduce((sum, value) => sum + value, 0) / allMinutes.length
    : 0;
  const activeBidderIds = metrics.bidderRows.map((row) => row.bidder.id);

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Monitoring"
          title="Watch the work as it happens"
          description="Track every bidder's daily pace, package progress, and QA results. Review submissions, then tell bidders how they are doing."
          actions={<Button href={HUNTER_ROUTES.pool} variant="primary" label="Assign more links" />}
        />

        <div className="hx-filters">
          <Select
            label="Task"
            value={taskFilter}
            onChange={(event) => setTaskFilter(event.target.value)}
          >
            <option value="all">All tasks</option>
            {tasks
              .filter((task) => applications.some((app) => app.taskId === task.id))
              .map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
          </Select>
          <Select
            label="Bidder"
            value={bidderFilter}
            onChange={(event) => setBidderFilter(event.target.value)}
          >
            <option value="all">All bidders</option>
            {activeBidderIds.map((id) => (
              <option key={id} value={id}>
                {bidderById(id)?.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="Delivered today"
            value={deliveredToday}
            icon="send"
            footnote={target ? `Daily target ${target}` : "No daily target"}
            delta={
              target
                ? {
                    text:
                      deliveredToday >= target ? "Target met" : `${target - deliveredToday} to go`,
                    tone: deliveredToday >= target ? "success" : "warning",
                  }
                : undefined
            }
          />
          <StatCard
            label="QA pass rate"
            value={percent(qaRate(counts), 1)}
            icon="check"
            tone="success"
            footnote={`${counts.qa_passed} passed · ${counts.returned} returned`}
          />
          <StatCard
            label="Awaiting your QA"
            value={counts.submitted}
            icon="eye"
            tone="warning"
            footnote="Approve to release payment"
          />
          <StatCard
            label="Avg. time per link"
            value={avgMinutes ? `${avgMinutes.toFixed(1)} min` : "—"}
            icon="clock"
            footnote={`${counts.queued + counts.in_progress} links still in flight`}
          />
        </div>

        <Tabs
          label="Monitoring views"
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "bidders", label: "Bidders" },
            { value: "packages", label: "Packages" },
            { value: "review", label: `Review queue (${counts.submitted})` },
            { value: "activity", label: "Activity" },
            { value: "feedback", label: "Feedback" },
          ]}
        />

        {tab === "overview" && (
          <OverviewTab
            apps={apps}
            counts={counts}
            target={target}
            bidderRows={metrics.bidderRows.filter(
              (row) => bidderFilter === "all" || row.bidder.id === bidderFilter,
            )}
          />
        )}
        {tab === "bidders" && <BiddersTab rows={bidderRows} onFeedback={setFeedbackFor} />}
        {tab === "packages" && <PackagesTab rows={packageRows} />}
        {tab === "review" && <ReviewTab apps={apps} />}
        {tab === "activity" && <ActivityTab apps={apps} />}
        {tab === "feedback" && <FeedbackTab bidderIds={activeBidderIds} />}

        <FeedbackDialog bidderId={feedbackFor} onClose={() => setFeedbackFor(null)} />
      </div>
    </PageBody>
  );
}
