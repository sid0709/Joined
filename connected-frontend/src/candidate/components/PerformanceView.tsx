"use client";

import { useMemo } from "react";
import { Glyph } from "sid-ui";

import { MONEY_LINKS, SectionNav } from "@/src/candidate/components/ui/SectionNav";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { RATE_LEVELS } from "@/src/candidate/data/account";
import { bidderQa } from "@/src/candidate/lib/derive";
import { DailyBars } from "@/src/shared/kit/charts/DailyBars";
import { Donut } from "@/src/shared/kit/charts/Donut";
import { Legend, Meter, type MeterTone } from "@/src/shared/kit/Meter";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Panel } from "@/src/shared/kit/Panel";
import { StatCard } from "@/src/shared/kit/StatCard";
import { percent, plural } from "@/src/shared/lib/format";
import { countStatuses, dailySeries } from "@/src/shared/lib/selectors";
import { Button, PageBody } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { POOL_BY_ID } from "@/src/shared/mock/pool";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

const ATS_TONES: MeterTone[] = ["accent", "violet", "positive", "caution", "soft", "neutral"];
const PLATFORM_QA = 91;

export function PerformanceView() {
  const { applications, assignments, profile, reviews } = useBidderWorkspace();
  const qa = bidderQa(applications);
  const counts = countStatuses(applications);
  const delivered = counts.qa_passed;
  const target = assignments
    .filter((item) => item.status === "active")
    .reduce((sum, item) => sum + item.dailyTarget, 0);
  const series = dailySeries(applications, 14, target);
  const workedDays = series.filter((point) => point.submitted > 0);
  const onTarget = workedDays.filter((point) => point.submitted >= point.target).length;

  const pace = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const item of applications) {
      if (!item.minutesSpent) continue;
      groups.set(item.packageId, [...(groups.get(item.packageId) ?? []), item.minutesSpent]);
    }
    return [...groups.entries()].map(([packageId, values]) => {
      const tier = PACKAGE_BY_ID.get(packageId);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      return { tier, average, guide: tier?.minutesPerLink ?? average, count: values.length };
    });
  }, [applications]);
  const avgMinutes = pace.length
    ? pace.reduce((sum, row) => sum + row.average * row.count, 0) /
      pace.reduce((sum, row) => sum + row.count, 0)
    : 0;

  const byAts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of applications) {
      if (item.status === "queued" || item.status === "in_progress") continue;
      const ats = POOL_BY_ID.get(item.jobId)?.ats ?? "Other";
      map.set(ats, (map.get(ats) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], index) => ({
        label,
        value,
        tone: ATS_TONES[index % ATS_TONES.length],
      }));
  }, [applications]);

  const levelIndex = RATE_LEVELS.findIndex((item) => item.level === profile.level);
  const next = RATE_LEVELS[levelIndex + 1];
  const openReviews = reviews.filter(
    (review) =>
      review.resolution === "open" && review.verdict !== "approved" && review.verdict !== "praise",
  ).length;
  const requirements = next
    ? [
        {
          label: `${next.minQa}% QA pass rate`,
          done: qa >= next.minQa,
          detail: `You're at ${percent(qa, 1)}`,
        },
        {
          label: `${next.minLinks} approved links`,
          done: delivered >= next.minLinks,
          detail: `${delivered} so far`,
        },
        {
          label: "No unanswered reviews",
          done: openReviews === 0,
          detail: `${plural(openReviews, "review")} open`,
        },
      ]
    : [];

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Performance"
          title="How hunters see your work"
          description="Quality, pace and responsiveness decide which desks trust you and how fast your rate grows. Everything here is visible to the hunters you work with."
          actions={<Button href={BIDDER_ROUTES.reviews} variant="secondary" label="Read reviews" />}
        />
        <SectionNav label="Earnings sections" links={MONEY_LINKS} />

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="QA pass rate"
            value={percent(qa, 1)}
            icon="check"
            tone="success"
            footnote={`Platform average ${PLATFORM_QA}%`}
            delta={{
              text: `${qa - PLATFORM_QA >= 0 ? "+" : ""}${(qa - PLATFORM_QA).toFixed(1)} pts vs average`,
              tone: qa >= PLATFORM_QA ? "success" : "danger",
            }}
          />
          <StatCard
            label="Average time per link"
            value={`${avgMinutes.toFixed(1)} min`}
            icon="clock"
            footnote="Across all packages"
          />
          <StatCard
            label="Days on target"
            value={`${onTarget}/${workedDays.length}`}
            icon="calendar"
            tone="warning"
            footnote="Worked days that met the daily target"
          />
          <StatCard
            label="Reply time"
            value="1.8 hr"
            icon="chat"
            footnote="Median across hunters, last 30 days"
          />
        </div>

        <div className="hx-split">
          <div className="hx-stack">
            <Panel
              title="Consistency"
              subtitle="Links submitted per day against your combined daily target"
            >
              <DailyBars points={series} />
              <Legend
                segments={[
                  {
                    label: "QA passed",
                    value: series.reduce((sum, point) => sum + point.qaPassed, 0),
                    tone: "positive",
                  },
                  {
                    label: "Awaiting QA or returned",
                    value: series.reduce((sum, point) => sum + point.submitted - point.qaPassed, 0),
                    tone: "soft",
                  },
                ]}
              />
            </Panel>

            <Panel title="Speed by package" subtitle="Your average against the Joined guide" flush>
              <div className="bx-table-wrap">
                <table className="bx-table">
                  <thead>
                    <tr>
                      <th>Package</th>
                      <th>Links</th>
                      <th>Your average</th>
                      <th>Guide</th>
                      <th>Compared</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pace.map((row) => {
                      const delta = ((row.guide - row.average) / row.guide) * 100;
                      return (
                        <tr key={row.tier?.id}>
                          <td>
                            <strong>{row.tier?.name}</strong>
                          </td>
                          <td className="hx-num">{row.count}</td>
                          <td className="hx-num">{row.average.toFixed(1)} min</td>
                          <td className="hx-num">{row.guide} min</td>
                          <td>
                            <span
                              className="hx-delta"
                              data-tone={delta >= 0 ? "success" : "warning"}
                            >
                              {delta >= 0
                                ? `${delta.toFixed(0)}% faster`
                                : `${Math.abs(delta).toFixed(0)}% slower`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="hx-stack">
            <Panel title="Work by application system">
              <div className="bx-donut">
                <Donut
                  segments={byAts}
                  centerValue={String(byAts.reduce((sum, item) => sum + item.value, 0))}
                  centerLabel="Links delivered"
                />
                <Legend segments={byAts} />
              </div>
            </Panel>

            <Panel
              title={next ? `Path to ${next.level}` : "You are at the top level"}
              subtitle={next ? next.multiplier : "Elite bidders get invitation-only desks"}
            >
              {next ? (
                <div className="hx-stack">
                  {requirements.map((item) => (
                    <div key={item.label} className="hx-check-row" data-done={item.done}>
                      <span className="hx-check-mark">
                        <Glyph name={item.done ? "check" : "dot"} size="0.9em" />
                      </span>
                      <span className="hx-grow">
                        {item.label}
                        <span className="hx-small hx-faint bx-block">{item.detail}</span>
                      </span>
                    </div>
                  ))}
                  <Meter
                    label="Progress to next level"
                    total={next.minLinks}
                    segments={[
                      { label: "Links", value: Math.min(delivered, next.minLinks), tone: "accent" },
                    ]}
                  />
                  <div className="hx-chip-row">
                    {next.perks.map((perk) => (
                      <span key={perk} className="hx-chip">
                        {perk}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="hx-muted" style={{ margin: 0 }}>
                  Keep quality high to hold your level.
                </p>
              )}
            </Panel>

            <Panel title="Quality mix" subtitle="Status of every link you have worked on">
              <Meter
                large
                label="All links"
                segments={[
                  { label: "QA passed", value: counts.qa_passed, tone: "positive" },
                  { label: "Awaiting QA", value: counts.submitted, tone: "soft" },
                  { label: "Returned", value: counts.returned, tone: "critical" },
                  {
                    label: "In progress or queued",
                    value: counts.in_progress + counts.queued,
                    tone: "neutral",
                  },
                ]}
              />
              <Legend
                segments={[
                  { label: "QA passed", value: counts.qa_passed, tone: "positive" },
                  { label: "Awaiting QA", value: counts.submitted, tone: "soft" },
                  { label: "Returned", value: counts.returned, tone: "critical" },
                  { label: "To do", value: counts.in_progress + counts.queued, tone: "neutral" },
                ]}
              />
            </Panel>
          </div>
        </div>
      </div>
    </PageBody>
  );
}
