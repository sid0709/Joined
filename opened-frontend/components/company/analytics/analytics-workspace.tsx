"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Card,
  EmptyState,
  GridColumn,
  GridSystem,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Selector,
  Stack,
  Table,
  Text,
  useToast,
  type CardVariant,
  type TableColumn,
} from "@openseat/design-system";
import { SectionCard } from "@/components/section-card";
import { StatGrid } from "@/components/stat-card";
import {
  ANALYTICS_DATE_PRESETS,
  aggregateCompanyAnalytics,
  assistedMixHint,
  defaultAnalyticsFilters,
  formatPercent,
  resolveAnalyticsRange,
  type AnalyticsDatePreset,
  type AnalyticsFilters,
  type CompanyAnalyticsSnapshot,
  type FunnelStageMetric,
  type SourceBucket,
  type TimeInStageMetric,
} from "@/lib/analytics";
import { canManageCompany } from "@/lib/company/access";
import { fetchOverview, fetchTeam } from "@/lib/company/api";
import type { CompanyJob } from "@/lib/company/jobs";
import type { AuthCompany } from "@/lib/auth/types";
import { canPermission, currentMemberRole, denialReason, type TeamRole } from "@/lib/rbac";

const BAR_HEIGHT = 10;
const SWATCH = 8;
const FUNNEL_TONE: Record<string, CardVariant> = {
  views: "gray",
  applied: "blue",
  screening: "purple",
  interview: "orange",
  offer: "green",
  hired: "green",
};
const SOURCE_TONE: Record<string, CardVariant> = {
  direct: "blue",
  bidder: "purple",
  agent: "orange",
  referral: "green",
  other: "gray",
};

function MixBar({
  buckets,
  tones,
}: {
  buckets: { id: string; count: number }[];
  tones: Record<string, CardVariant>;
}) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (total === 0) {
    return <Card padding={0} height={BAR_HEIGHT} width="100%" variant="gray" />;
  }
  return (
    <HStack gap={0.5}>
      {buckets
        .filter((bucket) => bucket.count > 0)
        .map((bucket) => (
          <Card
            key={bucket.id}
            padding={0}
            height={BAR_HEIGHT}
            width={`${(bucket.count / total) * 100}%`}
            variant={tones[bucket.id] ?? "gray"}
          />
        ))}
    </HStack>
  );
}

function funnelColumns(): TableColumn<FunnelStageMetric>[] {
  return [
    {
      key: "label",
      header: "Stage",
      render: (row) => <Text weight="medium">{row.label}</Text>,
    },
    {
      key: "count",
      header: "Count",
      align: "end",
      render: (row) => (
        <Text weight="medium" hasTabularNumbers>
          {row.count}
        </Text>
      ),
    },
    {
      key: "conversionFromPrev",
      header: "From prior",
      align: "end",
      render: (row) => (
        <Text color="secondary" hasTabularNumbers>
          {formatPercent(row.conversionFromPrev)}
        </Text>
      ),
    },
  ];
}

function timeColumns(): TableColumn<TimeInStageMetric>[] {
  return [
    {
      key: "label",
      header: "Stage",
      render: (row) => (
        <HStack gap={2} vAlign="center">
          <Text weight="medium">{row.label}</Text>
          {row.isProxy ? <Badge label="Proxy" variant="neutral" /> : null}
        </HStack>
      ),
    },
    {
      key: "count",
      header: "In stage",
      align: "end",
      render: (row) => (
        <Text hasTabularNumbers color="secondary">
          {row.count}
        </Text>
      ),
    },
    {
      key: "avgDays",
      header: "Avg days",
      align: "end",
      render: (row) => (
        <Text weight="medium" hasTabularNumbers>
          {row.avgDays == null ? "—" : row.avgDays}
        </Text>
      ),
    },
    {
      key: "medianDays",
      header: "Median",
      align: "end",
      render: (row) => (
        <Text hasTabularNumbers color="secondary">
          {row.medianDays == null ? "—" : row.medianDays}
        </Text>
      ),
    },
  ];
}

function sourceColumns(): TableColumn<SourceBucket>[] {
  return [
    {
      key: "label",
      header: "Source",
      render: (row) => (
        <HStack gap={2} vAlign="center">
          <Card
            padding={0}
            width={SWATCH}
            height={SWATCH}
            variant={SOURCE_TONE[row.id] ?? "gray"}
          />
          <Text weight="medium">{row.label}</Text>
        </HStack>
      ),
    },
    {
      key: "count",
      header: "Applicants",
      align: "end",
      render: (row) => (
        <Text hasTabularNumbers weight="medium">
          {row.count}
        </Text>
      ),
    },
    {
      key: "share",
      header: "Share",
      align: "end",
      render: (row) => (
        <Text hasTabularNumbers color="secondary">
          {row.share}%
        </Text>
      ),
    },
  ];
}

/** Company funnel analytics — client aggregate of jobs / applicants / interviews. */
export function AnalyticsWorkspace({ company }: { company: AuthCompany }) {
  const toast = useToast();
  const [jobs, setJobs] = useState<CompanyJob[]>([]);
  const [applicants, setApplicants] = useState<
    Awaited<ReturnType<typeof fetchOverview>>["applicants"]
  >([]);
  const [interviews, setInterviews] = useState<
    Awaited<ReturnType<typeof fetchOverview>>["interviews"]
  >([]);
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultAnalyticsFilters);
  const [actorRole, setActorRole] = useState<TeamRole | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([fetchOverview(), fetchTeam()])
      .then(([overview, team]) => {
        if (!active) return;
        setJobs(overview.jobs);
        setApplicants(overview.applicants);
        setInterviews(overview.interviews);
        setActorRole(currentMemberRole(team.members));
        setLoaded(true);
      })
      .catch((error: Error) => {
        if (!active) return;
        setFailed(true);
        toast({ body: error.message, type: "error" });
      });
    return () => {
      active = false;
    };
  }, [toast]);

  const manageCompany = canManageCompany(company);
  const canView = manageCompany || canPermission(actorRole, "analytics.view");
  // TODO(einstein): enforce analytics.view on GET /company/analytics.

  const snapshot: CompanyAnalyticsSnapshot | null = useMemo(() => {
    if (!loaded) return null;
    return aggregateCompanyAnalytics({ jobs, applicants, interviews, filters });
  }, [loaded, jobs, applicants, interviews, filters]);

  const jobOptions = useMemo(
    () => [
      { value: "", label: "All jobs" },
      ...jobs.map((job) => ({ value: job.id, label: job.title })),
    ],
    [jobs],
  );

  const setPreset = (preset: AnalyticsDatePreset) => {
    const range = resolveAnalyticsRange(preset);
    setFilters((prev) => ({ ...prev, preset, from: range.from, to: range.to }));
  };

  if (failed) {
    return (
      <EmptyState
        title="Couldn’t load analytics"
        description="Refresh once the hiring API is running."
      />
    );
  }

  if (!loaded || !snapshot) return null;

  if (!canView) {
    return (
      <Stack gap={4}>
        <Text type="supporting" color="secondary">
          {denialReason(actorRole, "analytics.view")}
        </Text>
      </Stack>
    );
  }

  const { funnel, sourceMix, timeInStage, attendance, viewsToApplicants } = snapshot;

  return (
    <Stack gap={6}>
      <HStack gap={3} vAlign="center" wrap="wrap">
        <Selector
          label="Job"
          isLabelHidden
          options={jobOptions}
          value={filters.jobId ?? ""}
          onChange={(value) => setFilters((prev) => ({ ...prev, jobId: value ? value : null }))}
        />
        <SegmentedControl
          label="Date range"
          value={filters.preset}
          onChange={(value) => setPreset(value as AnalyticsDatePreset)}
        >
          {ANALYTICS_DATE_PRESETS.map((item) => (
            <SegmentedControlItem key={item.value} value={item.value} label={item.label} />
          ))}
        </SegmentedControl>
        {snapshot.source === "client_v1" ? (
          <Badge label="Client aggregate" variant="neutral" />
        ) : null}
      </HStack>

      <StatGrid
        stats={[
          {
            label: "Views → apply",
            value: formatPercent(viewsToApplicants.rate),
            hint: `${viewsToApplicants.applicants} applicants from ${viewsToApplicants.views} views`,
          },
          {
            label: "Assisted mix",
            value: formatPercent(sourceMix.assistedShare),
            hint: assistedMixHint(sourceMix.assistedShare),
          },
          {
            label: "Attendance",
            value: formatPercent(attendance.rate),
            hint: `${attendance.attended} attended · ${attendance.noShow} no-show`,
          },
          {
            label: "Hired",
            value: String(funnel.stages.find((stage) => stage.id === "hired")?.count ?? 0),
            hint: "Reached hired in range",
          },
        ]}
      />

      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={7}>
          <Stack gap={6}>
            <SectionCard
              title="Stage conversion"
              description="Views through hired. Conversion is from the prior step."
            >
              <Stack gap={4}>
                <MixBar
                  buckets={funnel.stages.map((stage) => ({
                    id: stage.id,
                    count: stage.count,
                  }))}
                  tones={FUNNEL_TONE}
                />
                <Table
                  caption="Funnel stages"
                  columns={funnelColumns()}
                  rows={funnel.stages}
                  rowKey={(row) => row.id}
                  variant="plain"
                />
              </Stack>
            </SectionCard>

            <SectionCard
              title="Time in stage"
              description="Days applicants have sat in their current stage. Proxy uses applied date until Einstein returns stageEnteredAt."
            >
              <Table
                caption="Time in stage"
                columns={timeColumns()}
                rows={timeInStage.stages}
                rowKey={(row) => row.stage}
                variant="plain"
              />
            </SectionCard>
          </Stack>
        </GridColumn>

        <GridColumn span="full" lg={5}>
          <Stack gap={6}>
            <SectionCard
              title="Source mix"
              description="Direct vs assisted (bidder / agent). Referral wins when a referralSource is set."
            >
              <Stack gap={4}>
                <MixBar buckets={sourceMix.buckets} tones={SOURCE_TONE} />
                {sourceMix.buckets.every((bucket) => bucket.count === 0) ? (
                  <EmptyState
                    isCompact
                    title="No applicants in range"
                    description="Widen the date range or pick another job."
                  />
                ) : (
                  <Table
                    caption="Source mix"
                    columns={sourceColumns()}
                    rows={sourceMix.buckets}
                    rowKey={(row) => row.id}
                    variant="plain"
                  />
                )}
              </Stack>
            </SectionCard>

            <SectionCard
              title="Attendance"
              description="Held rounds only (attended or no-show). A no-show returns the interview price."
            >
              <Stack gap={3}>
                <HStack hAlign="between" vAlign="center">
                  <Text color="secondary">Held</Text>
                  <Text weight="medium" hasTabularNumbers>
                    {attendance.held}
                  </Text>
                </HStack>
                <HStack hAlign="between" vAlign="center">
                  <Text color="secondary">Attended</Text>
                  <Text weight="medium" hasTabularNumbers>
                    {attendance.attended}
                  </Text>
                </HStack>
                <HStack hAlign="between" vAlign="center">
                  <Text color="secondary">No-show</Text>
                  <Text weight="medium" hasTabularNumbers>
                    {attendance.noShow}
                  </Text>
                </HStack>
                <HStack hAlign="between" vAlign="center">
                  <Text color="secondary">Attendance rate</Text>
                  <Text weight="semibold" hasTabularNumbers>
                    {formatPercent(attendance.rate)}
                  </Text>
                </HStack>
              </Stack>
            </SectionCard>
          </Stack>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
