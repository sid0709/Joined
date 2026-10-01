"use client";

import { Glyph, Table } from "@joined/design-system";
import Link from "next/link";
import { useState } from "react";

import type { ApplicationRecord, ApplicationStatus } from "@/src/shared/types/marketplace";

import { useHunter } from "@/src/client/context/HunterContext";
import { Panel } from "@/src/shared/kit/Panel";
import { Person } from "@/src/shared/kit/Person";
import { ApplicationStatusBadge } from "@/src/shared/kit/StatusBadge";
import { Tabs } from "@/src/shared/kit/Tabs";
import { relativeTime } from "@/src/shared/lib/format";
import { Button, Modal, Select, TextArea } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { POOL_BY_ID } from "@/src/shared/mock/pool";

type Queue = Extract<ApplicationStatus, "submitted" | "returned" | "failed">;

const RETURN_REASONS = [
  "Resume version mismatch",
  "Screenshot missing",
  "Wrong answers on screening questions",
  "Duplicate application",
  "Other",
];

interface Row extends Record<string, unknown> {
  id: string;
  app: ApplicationRecord;
}

export function ReviewTab({ apps }: { apps: ApplicationRecord[] }) {
  const { bidderById, reviewApplications } = useHunter();
  const [queue, setQueue] = useState<Queue>("submitted");
  const [selected, setSelected] = useState<string[]>([]);
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [note, setNote] = useState("");

  const counts = { submitted: 0, returned: 0, failed: 0 };
  for (const app of apps) if (app.status in counts) counts[app.status as Queue] += 1;
  const rows: Row[] = apps
    .filter((app) => app.status === queue)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((app) => ({ id: app.id, app }));
  const active = selected.filter((id) => rows.some((row) => row.id === id));

  const approve = () => {
    reviewApplications(active, "approve");
    setSelected([]);
  };
  const sendBack = () => {
    reviewApplications(active, "return", note.trim() ? `${reason}: ${note.trim()}` : reason);
    setReturning(false);
    setNote("");
    setSelected([]);
  };

  return (
    <Panel
      title="Review queue"
      subtitle="Approving a link releases payment to the bidder; returning it asks them to fix it"
      actions={
        <Tabs
          label="Queue"
          value={queue}
          onChange={(next) => {
            setQueue(next);
            setSelected([]);
          }}
          options={[
            { value: "submitted", label: `Needs QA (${counts.submitted})` },
            { value: "returned", label: `Returned (${counts.returned})` },
            { value: "failed", label: `Failed (${counts.failed})` },
          ]}
        />
      }
      flush
    >
      <Table<Row>
        variant="plain"
        caption="Review queue"
        rows={rows}
        rowKey={(row) => row.id}
        selection={queue === "submitted" ? "multiple" : "none"}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        pageSize={10}
        empty={
          <span className="hx-muted">
            Nothing here. Every application in this queue has been handled.
          </span>
        }
        columns={[
          {
            key: "job",
            header: "Application",
            render: ({ app }) => {
              const job = POOL_BY_ID.get(app.jobId);
              return (
                <div className="hx-list-body">
                  <span className="hx-list-title">{job?.title}</span>
                  <span className="hx-list-meta">
                    {job?.company} · {job?.ats}
                  </span>
                </div>
              );
            },
          },
          {
            key: "bidder",
            header: "Bidder",
            render: ({ app }) => (
              <Person
                name={bidderById(app.bidderId)?.name ?? "Bidder"}
                detail={PACKAGE_BY_ID.get(app.packageId)?.name}
              />
            ),
          },
          {
            key: "status",
            header: "Status",
            render: ({ app }) => (
              <div className="hx-stack hx-stack-sm">
                <ApplicationStatusBadge status={app.status} />
                {app.issue && <span className="hx-small hx-muted">{app.issue}</span>}
              </div>
            ),
          },
          {
            key: "minutes",
            header: "Time spent",
            align: "end",
            render: ({ app }) => (
              <span className="hx-num">{app.minutesSpent ? `${app.minutesSpent} min` : "—"}</span>
            ),
          },
          {
            key: "updatedAt",
            header: "Updated",
            render: ({ app }) => <span>{relativeTime(app.updatedAt)}</span>,
          },
          {
            key: "link",
            header: "",
            align: "end",
            render: ({ app }) => (
              <Link
                className="hx-link"
                href={POOL_BY_ID.get(app.jobId)?.applyUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                aria-label="Open application link"
              >
                <Glyph name="link" />
              </Link>
            ),
          },
        ]}
      />

      {active.length > 0 && (
        <div className="hx-bulkbar" style={{ margin: "var(--space-4)" }}>
          <span className="hx-strong">{active.length} selected</span>
          <div className="hx-row">
            <Button
              variant="secondary"
              label="Return with note"
              onClick={() => setReturning(true)}
            />
            <Button variant="primary" label="Approve and release payment" onClick={approve} />
          </div>
        </div>
      )}

      <Modal
        open={returning}
        onClose={() => setReturning(false)}
        title={`Return ${active.length} application${active.length === 1 ? "" : "s"}`}
        footer={
          <div className="hx-row hx-row-between" style={{ padding: "var(--space-4)" }}>
            <Button variant="ghost" label="Cancel" onClick={() => setReturning(false)} />
            <Button variant="primary" label="Return to bidder" onClick={sendBack} />
          </div>
        }
      >
        <div className="hx-inline-form" style={{ padding: "var(--space-4)" }}>
          <Select label="Reason" value={reason} onChange={(event) => setReason(event.target.value)}>
            {RETURN_REASONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <TextArea
            label="Note to the bidder (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </Modal>
    </Panel>
  );
}
