"use client";

import { useState } from "react";
import {
  HStack,
  Icon,
  KanbanBoard,
  Selector,
  Stack,
  Switch,
  TextInput,
  icons,
  useToast,
} from "@openseat/design-system";
import { StatGrid } from "@/components/stat-card";
import {
  APPLICANTS,
  APPLICANT_COLUMNS,
  APPLICANT_STAGE_BY_ID,
  COMPANY_JOBS,
  STRONG_FIT,
  type Applicant,
  type ApplicantStage,
} from "@/lib/company";
import { ApplicantCard } from "./applicant-card";
import { ApplicantDrawer } from "./applicant-drawer";

const COLUMN_WIDTH = 240;
const PERCENT = 100;
const SEARCH_WIDTH = 240;
const ALL_JOBS = "all";
const JOB_OPTIONS = [
  { value: ALL_JOBS, label: "All jobs" },
  ...COMPANY_JOBS.filter((job) => job.status !== "draft").map((job) => ({
    value: job.id,
    label: job.title,
  })),
];

/** The hiring pipeline: filter, drag candidates between stages, open one to decide. */
export function ApplicantsWorkspace() {
  const toast = useToast();
  const [people, setPeople] = useState(APPLICANTS);
  const [jobId, setJobId] = useState(ALL_JOBS);
  const [query, setQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = people.filter(
    (person) =>
      (jobId === ALL_JOBS || person.jobId === jobId) &&
      (!verifiedOnly || person.verified) &&
      (!needle ||
        `${person.name} ${person.headline} ${person.skills.join(" ")}`
          .toLowerCase()
          .includes(needle)),
  );
  const active = visible.filter(
    (person) => person.columnId !== "rejected" && person.columnId !== "hired",
  );

  const replace = (next: Applicant, message?: string) => {
    setPeople((current) => current.map((person) => (person.id === next.id ? next : person)));
    if (message) {
      toast({ body: message });
      setOpenId(null);
    }
  };

  return (
    <Stack gap={6}>
      <StatGrid
        stats={[
          { label: "In pipeline", value: String(active.length), hint: "Not yet hired or rejected" },
          {
            label: "New",
            value: String(visible.filter((person) => person.columnId === "new").length),
            hint: "Waiting for a first look",
          },
          {
            label: "Strong fits",
            value: String(active.filter((person) => person.fit >= STRONG_FIT).length),
            hint: `${STRONG_FIT}% fit or higher`,
          },
          {
            label: "Verified",
            value: `${visible.length === 0 ? 0 : Math.round((visible.filter((person) => person.verified).length / visible.length) * PERCENT)}%`,
            hint: "Identity checked",
          },
        ]}
      />

      <HStack gap={3} vAlign="center" wrap="wrap">
        <Selector
          label="Job"
          isLabelHidden
          options={JOB_OPTIONS}
          value={jobId}
          onChange={setJobId}
        />
        <TextInput
          label="Search candidates"
          isLabelHidden
          placeholder="Search name or skill"
          startIcon={<Icon icon={icons.search} />}
          value={query}
          onChange={setQuery}
          hasClear
          width={SEARCH_WIDTH}
        />
        <Switch label="Verified only" value={verifiedOnly} onChange={setVerifiedOnly} />
      </HStack>

      <KanbanBoard
        label="Candidates by stage"
        columns={APPLICANT_COLUMNS}
        items={visible}
        onItemsChange={(next, move) => {
          const hidden = people.filter(
            (person) => !visible.some((shown) => shown.id === person.id),
          );
          setPeople([...hidden, ...next]);
          if (move.from.columnId !== move.to.columnId) {
            toast({
              body: `Moved to ${APPLICANT_STAGE_BY_ID[move.to.columnId as ApplicantStage].title}`,
            });
          }
        }}
        getItemLabel={(person) => `${person.name}, ${person.fit}% fit`}
        renderItem={(person) => (
          <ApplicantCard applicant={person} onOpen={() => setOpenId(person.id)} />
        )}
        columnWidth={COLUMN_WIDTH}
        emptyText="Drop a candidate here"
      />

      <ApplicantDrawer
        applicant={people.find((person) => person.id === openId) ?? null}
        onClose={() => setOpenId(null)}
        onChange={replace}
      />
    </Stack>
  );
}
