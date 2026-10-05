"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Glyph, Table } from "sid-ui";

import type { PoolJob } from "@/src/shared/types/marketplace";

import { AssignDialog } from "@/src/client/components/pool/AssignDialog";
import { useHunter } from "@/src/client/context/HunterContext";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { StatCard } from "@/src/shared/kit/StatCard";
import { Badge, Banner, Button, Input, PageBody, Select } from "@/src/shared/marketplace-ui";
import { POOL_ATS } from "@/src/shared/mock/pool";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

const QUICK_SELECT = 20;
const PAGE_SIZE = 12;
const FRESH_DAYS = 3;

interface Row extends Record<string, unknown> {
  id: string;
  job: PoolJob;
  assignedTo?: string;
}

export function PoolView() {
  const params = useSearchParams();
  const { poolJobs, assignedJobs, assignments, bidderById, taskById } = useHunter();
  const [query, setQuery] = useState("");
  const [ats, setAts] = useState("all");
  const [workplace, setWorkplace] = useState("all");
  const [seniority, setSeniority] = useState("all");
  const [showAssigned, setShowAssigned] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const available = poolJobs.filter((job) => !assignedJobs.has(job.id));
  const presetTask = taskById(params.get("task") ?? "");
  const presetBidder = bidderById(params.get("bidder") ?? "");

  const rows: Row[] = useMemo(
    () =>
      poolJobs
        .filter(
          (job) =>
            (showAssigned || !assignedJobs.has(job.id)) &&
            (ats === "all" || job.ats === ats) &&
            (workplace === "all" || job.workplace === workplace) &&
            (seniority === "all" || job.seniority === seniority) &&
            `${job.company} ${job.title} ${job.location}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .map((job) => {
          const assignment = assignments.find((item) => item.id === assignedJobs.get(job.id));
          return {
            id: job.id,
            job,
            assignedTo: assignment ? bidderById(assignment.bidderId)?.name : undefined,
          };
        }),
    [
      poolJobs,
      assignedJobs,
      assignments,
      bidderById,
      showAssigned,
      ats,
      workplace,
      seniority,
      query,
    ],
  );

  const selectedJobs = poolJobs.filter(
    (job) => selected.includes(job.id) && !assignedJobs.has(job.id),
  );
  const fresh = available.filter((job) => job.postedDaysAgo <= FRESH_DAYS).length;

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Job pool"
          title="Application links, ready to assign"
          description="Companies submit their application links to the pool, and Joined admins keep it current. You choose which links to send to each connected bidder."
          actions={<Button href={HUNTER_ROUTES.tasks} variant="secondary" label="My tasks" />}
        />

        {presetTask && (
          <Banner
            tone="info"
            title={`Assigning for ${presetTask.title}`}
            description={
              presetBidder
                ? `Select links below to hand to ${presetBidder.name}. Only links matching the task's packages can be assigned.`
                : "Select links below, then choose a connected bidder."
            }
          />
        )}
        {notice && <Banner tone="success" title={notice} />}

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="Links available"
            value={available.length}
            icon="link"
            footnote={`${poolJobs.length} in the pool overall`}
          />
          <StatCard
            label="Added in the last 3 days"
            value={fresh}
            icon="sparkle"
            tone="success"
            footnote="Fresh postings convert best"
          />
          <StatCard
            label="Assigned by you"
            value={assignedJobs.size}
            icon="send"
            footnote="Across all bidders"
          />
          <StatCard
            label="Application systems"
            value={POOL_ATS.length}
            icon="grid"
            footnote={POOL_ATS.join(" · ")}
          />
        </div>

        <div className="hx-filters">
          <div className="hx-filter-wide">
            <Input
              label="Search links"
              placeholder="Company, title, or location"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Select
            label="Application system"
            value={ats}
            onChange={(event) => setAts(event.target.value)}
          >
            <option value="all">All systems</option>
            {POOL_ATS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select
            label="Workplace"
            value={workplace}
            onChange={(event) => setWorkplace(event.target.value)}
          >
            <option value="all">Any workplace</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
            <option value="On-site">On-site</option>
          </Select>
          <Select
            label="Seniority"
            value={seniority}
            onChange={(event) => setSeniority(event.target.value)}
          >
            <option value="all">Any level</option>
            <option value="Mid">Mid</option>
            <option value="Senior">Senior</option>
            <option value="Lead">Lead</option>
            <option value="Director">Director</option>
          </Select>
          <Button
            variant={showAssigned ? "primary" : "secondary"}
            label={showAssigned ? "Showing assigned links" : "Show assigned links"}
            onClick={() => setShowAssigned((current) => !current)}
          />
          <Button
            variant="secondary"
            label={`Select first ${QUICK_SELECT}`}
            onClick={() =>
              setSelected(
                rows
                  .filter((row) => !row.assignedTo)
                  .slice(0, QUICK_SELECT)
                  .map((row) => row.id),
              )
            }
          />
        </div>

        <Table<Row>
          caption="Job pool"
          rows={rows}
          rowKey={(row) => row.id}
          selection="multiple"
          selectedKeys={selected}
          onSelectionChange={setSelected}
          pageSize={PAGE_SIZE}
          empty={<span className="hx-muted">No links match these filters.</span>}
          columns={[
            {
              key: "job",
              header: "Role",
              sortable: true,
              sortValue: (row) => row.job.company,
              render: (row) => (
                <div className="hx-list-body">
                  <span className="hx-list-title">{row.job.title}</span>
                  <span className="hx-list-meta">
                    {row.job.company} · {row.job.function}
                  </span>
                </div>
              ),
            },
            {
              key: "ats",
              header: "System",
              sortable: true,
              sortValue: (row) => row.job.ats,
              render: (row) => <Badge label={row.job.ats} tone="neutral" />,
            },
            {
              key: "location",
              header: "Location",
              render: (row) => (
                <div className="hx-list-body">
                  <span>{row.job.location}</span>
                  <span className="hx-list-meta">
                    {row.job.workplace} · {row.job.seniority}
                  </span>
                </div>
              ),
            },
            {
              key: "salary",
              header: "Salary",
              render: (row) => <span className="hx-num">{row.job.salary}</span>,
            },
            {
              key: "postedDaysAgo",
              header: "Posted",
              sortable: true,
              sortValue: (row) => row.job.postedDaysAgo,
              render: (row) => (
                <span>
                  {row.job.postedDaysAgo === 0 ? "Today" : `${row.job.postedDaysAgo} d ago`}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (row) =>
                row.assignedTo ? (
                  <Badge label={`With ${row.assignedTo.split(" ")[0]}`} tone="info" />
                ) : (
                  <Badge label="Available" tone="success" />
                ),
            },
            {
              key: "url",
              header: "",
              align: "end",
              render: (row) => (
                <Link
                  className="hx-link"
                  href={row.job.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${row.job.company} application`}
                >
                  <Glyph name="link" />
                </Link>
              ),
            },
          ]}
        />

        {selectedJobs.length > 0 && (
          <div className="hx-bulkbar">
            <span className="hx-strong">{selectedJobs.length} links selected</span>
            <div className="hx-row">
              <Button variant="ghost" label="Clear" onClick={() => setSelected([])} />
              <Button
                variant="primary"
                label="Assign to a bidder"
                onClick={() => setDialogOpen(true)}
              />
            </div>
          </div>
        )}

        <AssignDialog
          key={`${params.get("task") ?? ""}-${params.get("bidder") ?? ""}-${dialogOpen}`}
          open={dialogOpen}
          jobs={selectedJobs}
          presetTaskId={presetTask?.id}
          presetBidderId={presetBidder?.id}
          onClose={() => setDialogOpen(false)}
          onAssigned={(_, count) => {
            setDialogOpen(false);
            setSelected([]);
            setNotice(`${count} links assigned. Track their progress on the Monitoring page.`);
          }}
        />
      </div>
    </PageBody>
  );
}
