"use client";

import { useState } from "react";
import {
  Badge,
  HStack,
  Icon,
  Stack,
  Tab,
  TabList,
  TextInput,
  icons,
  useToast,
} from "@openseat/design-system";
import { StatGrid } from "@/components/stat-card";
import {
  COMPANY_JOBS,
  JOB_STATUS_META,
  pipelineTotal,
  type CompanyJob,
  type CompanyJobStatus,
} from "@/lib/company";
import { CompanyJobDrawer } from "./company-job-drawer";
import { CompanyJobTable, type JobAction } from "./company-job-table";

type Filter = CompanyJobStatus | "all";

const SEARCH_WIDTH = 260;
const FILTERS: Filter[] = ["all", "open", "paused", "draft", "closed"];
const NEXT_STATUS: Partial<Record<JobAction, CompanyJobStatus>> = {
  pause: "paused",
  resume: "open",
  close: "closed",
  publish: "open",
};
const DONE_MESSAGE: Partial<Record<JobAction, string>> = {
  pause: "paused. Candidates can still see it but can’t apply.",
  resume: "is open again.",
  close: "closed. Candidates in progress will be told.",
  publish: "is live.",
};

/** The jobs console: stats, status tabs, search, a table, and a detail drawer. */
export function CompanyJobsWorkspace() {
  const toast = useToast();
  const [jobs, setJobs] = useState(COMPANY_JOBS);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const searched = jobs.filter(
    (job) => !needle || `${job.title} ${job.team} ${job.location}`.toLowerCase().includes(needle),
  );
  const shown = filter === "all" ? searched : searched.filter((job) => job.status === filter);
  const live = jobs.filter((job) => job.status === "open");

  const act = (job: CompanyJob, action: JobAction) => {
    if (action === "open") return setOpenId(job.id);
    const next = NEXT_STATUS[action];
    if (!next) return;
    setJobs((current) =>
      current.map((item) => (item.id === job.id ? { ...item, status: next } : item)),
    );
    toast({ body: `${job.title} ${DONE_MESSAGE[action]}` });
  };

  return (
    <Stack gap={6}>
      <StatGrid
        stats={[
          { label: "Live jobs", value: String(live.length), hint: `${jobs.length} in total` },
          {
            label: "Candidates",
            value: String(live.reduce((sum, job) => sum + pipelineTotal(job.pipeline), 0)),
            hint: "Across live jobs",
          },
          {
            label: "Views",
            value: jobs.reduce((sum, job) => sum + job.views, 0).toLocaleString(),
            hint: "Since posting",
          },
          { label: "Cost to post", value: "$0", hint: "Pay only for attended interviews" },
        ]}
      />

      <HStack hAlign="between" vAlign="end" gap={3} wrap="wrap">
        <TabList value={filter} onChange={(value) => setFilter(value as Filter)} overflow="scroll">
          {FILTERS.map((value) => (
            <Tab
              key={value}
              value={value}
              label={value === "all" ? "All" : JOB_STATUS_META[value].label}
              endContent={
                <Badge
                  label={String(
                    value === "all"
                      ? searched.length
                      : searched.filter((job) => job.status === value).length,
                  )}
                  variant="neutral"
                />
              }
            />
          ))}
        </TabList>
        <TextInput
          label="Search jobs"
          isLabelHidden
          placeholder="Search title, team, or city"
          startIcon={<Icon icon={icons.search} />}
          value={query}
          onChange={setQuery}
          hasClear
          width={SEARCH_WIDTH}
        />
      </HStack>

      <CompanyJobTable jobs={shown} onAction={act} />
      <CompanyJobDrawer
        job={jobs.find((job) => job.id === openId) ?? null}
        onClose={() => setOpenId(null)}
        onAction={act}
      />
    </Stack>
  );
}
