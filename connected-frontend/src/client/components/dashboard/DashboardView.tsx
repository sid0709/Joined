"use client";

import { DailyBars } from "@/src/client/components/charts/DailyBars";
import { ActiveTasksPanel } from "@/src/client/components/dashboard/ActiveTasksPanel";
import { AttentionPanel } from "@/src/client/components/dashboard/AttentionPanel";
import { PoolSnapshot } from "@/src/client/components/dashboard/PoolSnapshot";
import { WorkflowStrip } from "@/src/client/components/dashboard/WorkflowStrip";
import { Legend } from "@/src/client/components/ui/Meter";
import { PageHeader } from "@/src/client/components/ui/PageHeader";
import { Panel } from "@/src/client/components/ui/Panel";
import { StatCard } from "@/src/client/components/ui/StatCard";
import { useHunter } from "@/src/client/context/HunterContext";
import { useHunterMetrics } from "@/src/client/hooks/useHunterMetrics";
import { money, percent } from "@/src/client/lib/format";
import { Button, PageBody } from "@/src/shared/marketplace-ui";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

export function DashboardView() {
  const { profile } = useHunter();
  const metrics = useHunterMetrics();
  const weekChange = metrics.lastWeek
    ? ((metrics.thisWeek - metrics.lastWeek) / metrics.lastWeek) * 100
    : 0;

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Job hunter workspace"
          title={`Good morning, ${profile.name.split(" ")[0]}`}
          description="Post tasks, connect with the bidders who contact you, assign links from the job pool, and watch every application come in."
          actions={
            <>
              <Button href={HUNTER_ROUTES.pool} variant="secondary" label="Browse job pool" />
              <Button href={HUNTER_ROUTES.newTask} variant="primary" label="Post a task" />
            </>
          }
        />

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="Applications delivered · 7 days"
            value={metrics.thisWeek}
            icon="send"
            trend={metrics.trend}
            delta={{
              text: `${weekChange >= 0 ? "+" : ""}${weekChange.toFixed(0)}% vs previous week`,
              tone: weekChange >= 0 ? "success" : "danger",
            }}
          />
          <StatCard
            label="QA pass rate"
            value={percent(metrics.qa, 1)}
            icon="check"
            tone="success"
            footnote={`${metrics.counts.qa_passed} passed · ${metrics.counts.returned} returned`}
          />
          <StatCard
            label="Awaiting your QA"
            value={metrics.awaitingReview.length}
            icon="eye"
            tone="warning"
            footnote="Approve to release payment"
          />
          <StatCard
            label="Outstanding to bidders"
            value={money(metrics.outstanding)}
            icon="download"
            tone={metrics.outstanding ? "danger" : "success"}
            footnote={`Wallet balance ${money(profile.balance)}`}
          />
        </div>

        <div className="hx-split">
          <div className="hx-stack">
            <Panel
              title="Daily throughput"
              subtitle="Applications delivered across all bidders, last 14 days"
            >
              <DailyBars points={metrics.daily} />
              <Legend
                segments={[
                  {
                    label: "QA passed",
                    value: metrics.daily.reduce((sum, point) => sum + point.qaPassed, 0),
                    tone: "positive",
                  },
                  {
                    label: "Awaiting QA or returned",
                    value: metrics.daily.reduce(
                      (sum, point) => sum + point.submitted - point.qaPassed,
                      0,
                    ),
                    tone: "soft",
                  },
                ]}
              />
            </Panel>
            <ActiveTasksPanel />
          </div>
          <div className="hx-stack">
            <AttentionPanel />
            <PoolSnapshot />
          </div>
        </div>

        <WorkflowStrip />
      </div>
    </PageBody>
  );
}
