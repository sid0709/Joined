"use client";

import { useEffect, useState } from "react";
import { Badge, HStack, Stack, Table, Text, useToast, type TableColumn } from "sid-ui";
import { fetchTeamAudit } from "@/lib/company/api";
import { formatShortDate } from "@/lib/dates";
import type { AuditEvent } from "@/lib/rbac";

const WHEN_WIDTH = 120;

/** Who changed roles / stages / offers — GET /v1/company/team/audit (audit.view). */
export function AuditTrailPanel({ canView }: { canView: boolean }) {
  const toast = useToast();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    fetchTeamAudit({ limit: 40 })
      .then((body) => {
        if (!active) return;
        setEvents(body.events);
        setLoaded(true);
      })
      .catch((error: Error) => {
        if (!active) return;
        setLoaded(true);
        toast({ body: error.message, type: "error" });
      });
    return () => {
      active = false;
    };
  }, [canView, toast]);

  if (!canView) {
    return (
      <Text type="supporting" color="secondary">
        Your role cannot view the audit trail.
      </Text>
    );
  }

  const columns: TableColumn<AuditEvent>[] = [
    {
      key: "at",
      header: "When",
      width: WHEN_WIDTH,
      render: (row) => (
        <Text type="supporting" color="secondary">
          {formatShortDate(new Date(row.at))}
        </Text>
      ),
    },
    {
      key: "summary",
      header: "Change",
      render: (row) => (
        <Stack gap={0}>
          <Text weight="medium">{row.summary}</Text>
          <Text type="supporting" color="secondary">
            {row.actorName || row.actorId || "Unknown"} · {row.subjectType}
            {row.subjectLabel ? ` · ${row.subjectLabel}` : ""}
          </Text>
        </Stack>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => <Badge label={row.action} variant="blue" />,
    },
  ];

  if (!loaded) {
    return (
      <Text type="supporting" color="secondary">
        Loading audit trail…
      </Text>
    );
  }

  if (events.length === 0) {
    return (
      <Stack gap={2}>
        <Text type="supporting" color="secondary">
          No audit events yet. Role changes, stage moves, offers, hires, billing, and job-access
          edits will show up here.
        </Text>
        <HStack gap={2} wrap="wrap">
          <Badge label="role.changed" variant="blue" />
          <Badge label="stage.moved" variant="blue" />
          <Badge label="offer.sent" variant="blue" />
          <Badge label="hire.marked" variant="blue" />
        </HStack>
      </Stack>
    );
  }

  return (
    <Table
      caption="Team audit trail"
      columns={columns}
      rows={events}
      rowKey={(row) => row.id}
      variant="plain"
    />
  );
}
