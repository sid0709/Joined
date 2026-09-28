"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  EmptyState,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Table,
  Text,
  type TableColumn,
} from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { SubmissionStatusBadge } from "@/components/status-badge";
import { relativeDay } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";
import { useScout } from "@/lib/scout-store";
import { ownedBy } from "@/lib/stats";
import type { Submission, SubmissionStatus } from "@/lib/types";

const FILTERS: { value: "all" | SubmissionStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "needs_review", label: "Review" },
  { value: "rejected", label: "Rejected" },
  { value: "duplicate", label: "Duplicate" },
];

export function SubmissionsWorkspace() {
  const router = useRouter();
  const { user, state } = useScout();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const rows = useMemo(() => {
    if (!user) return [];
    const mine = ownedBy(state.submissions, user.id);
    return filter === "all" ? mine : mine.filter((item) => item.status === filter);
  }, [filter, state.submissions, user]);

  if (!user) return null;

  const columns: TableColumn<Submission>[] = [
    {
      key: "title",
      header: "Job",
      sortable: true,
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{row.title}</Text>
          <Text type="supporting" color="secondary">
            {row.companyName} · {row.locationText || "Location unknown"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Stack gap={1}>
          <SubmissionStatusBadge status={row.status} />
          {row.hiddenJob ? <Badge label="Hidden job" variant="purple" /> : null}
          {row.expired ? <Badge label="Expired" variant="neutral" /> : null}
        </Stack>
      ),
    },
    {
      key: "applications",
      header: "Apps",
      sortable: true,
      sortValue: (row) => row.applications,
      render: (row) => <Text hasTabularNumbers>{row.applications}</Text>,
    },
    {
      key: "interviews",
      header: "Interviews",
      sortable: true,
      sortValue: (row) => row.interviews,
      render: (row) => <Text hasTabularNumbers>{row.interviews}</Text>,
    },
    {
      key: "hires",
      header: "Hires",
      sortable: true,
      sortValue: (row) => row.hires,
      render: (row) => <Text hasTabularNumbers>{row.hires}</Text>,
    },
    {
      key: "submittedAt",
      header: "Submitted",
      sortable: true,
      render: (row) => <Text type="supporting">{relativeDay(row.submittedAt)}</Text>,
    },
  ];

  return (
    <Stack gap={6}>
      <PageHeader
        title="My submissions"
        description="First approved submission owns the job. Stats update as hunters and bidders use it."
      />
      <SegmentedControl
        label="Status"
        value={filter}
        onChange={(value) => setFilter(value as typeof filter)}
      >
        {FILTERS.map((item) => (
          <SegmentedControlItem key={item.value} value={item.value} label={item.label} />
        ))}
      </SegmentedControl>
      <Table
        caption="Scout submissions"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(ROUTES.submission(row.id))}
        pageSize={8}
        empty={
          <EmptyState
            title="No submissions in this view"
            description="Submit an official apply URL to start earning on outcomes."
          />
        }
      />
    </Stack>
  );
}
