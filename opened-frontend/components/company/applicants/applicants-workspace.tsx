"use client";

import { useEffect, useState } from "react";
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
import { fetchApplicants, fetchJobs, moveApplicant, scheduleInterview } from "@/lib/company/api";
import {
  APPLICANT_COLUMNS,
  APPLICANT_STAGE_BY_ID,
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
const ALL_TAGS = "all";

/** The hiring pipeline: filter, drag candidates between stages, open one to decide. */
export function ApplicantsWorkspace() {
  const toast = useToast();
  const [people, setPeople] = useState<Applicant[]>([]);
  const [jobOptions, setJobOptions] = useState([{ value: ALL_JOBS, label: "All jobs" }]);
  const [jobId, setJobId] = useState(ALL_JOBS);
  const [query, setQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState(ALL_TAGS);

  useEffect(() => {
    let active = true;
    Promise.all([fetchApplicants(), fetchJobs()])
      .then(([nextPeople, jobs]) => {
        if (!active) return;
        setPeople(nextPeople);
        setJobOptions([
          { value: ALL_JOBS, label: "All jobs" },
          ...jobs
            .filter((job) => job.status !== "draft")
            .map((job) => ({ value: job.id, label: job.title })),
        ]);
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    return () => {
      active = false;
    };
  }, [toast]);

  const needle = query.trim().toLowerCase();
  const tagOptions = [
    { value: ALL_TAGS, label: "All pools" },
    ...[...new Set(people.flatMap((person) => person.tags ?? []))]
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ value: tag, label: tag })),
  ];

  const visible = people.filter(
    (person) =>
      (jobId === ALL_JOBS || person.jobId === jobId) &&
      (tagFilter === ALL_TAGS || (person.tags ?? []).includes(tagFilter)) &&
      (!verifiedOnly || person.verified) &&
      (!needle ||
        `${person.name} ${person.headline} ${person.skills.join(" ")} ${(person.tags ?? []).join(" ")}`
          .toLowerCase()
          .includes(needle)),
  );
  const active = visible.filter(
    (person) => person.columnId !== "rejected" && person.columnId !== "hired",
  );

  const replace = (next: Applicant, message?: string) => {
    moveApplicant(next.id, next.columnId, next.notes, next.rating, next.tags)
      .then((saved) => {
        setPeople((current) => current.map((person) => (person.id === saved.id ? saved : person)));
        if (message) {
          toast({ body: message });
          setOpenId(null);
        }
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
  };

  const schedule = (
    person: Applicant,
    slot: { date: string; start: string; end: string; round: string },
  ) => {
    scheduleInterview({
      applicationId: person.id,
      round: slot.round,
      date: slot.date,
      start: slot.start,
      end: slot.end,
      format: "video",
    })
      .then(() => {
        setPeople((current) =>
          current.map((item) =>
            item.id === person.id ? { ...item, columnId: "interview" } : item,
          ),
        );
        toast({
          body: `Scheduled ${person.name}. The interview price was taken from your balance.`,
        });
        setOpenId(null);
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
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
          options={jobOptions}
          value={jobId}
          onChange={setJobId}
        />
        <Selector
          label="Pool"
          isLabelHidden
          options={tagOptions}
          value={tagFilter}
          onChange={setTagFilter}
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
          const moved = next.find((person) => person.id === move.itemId);
          setPeople([...hidden, ...next]);
          if (move.from.columnId !== move.to.columnId && moved) {
            moveApplicant(moved.id, move.to.columnId as ApplicantStage)
              .then((saved) => {
                setPeople((current) =>
                  current.map((person) => (person.id === saved.id ? saved : person)),
                );
                toast({
                  body: `Moved to ${APPLICANT_STAGE_BY_ID[move.to.columnId as ApplicantStage].title}`,
                });
              })
              .catch((error: Error) => {
                setPeople(people);
                toast({ body: error.message, type: "error" });
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
        allApplicants={people}
        onClose={() => setOpenId(null)}
        onChange={replace}
        onSchedule={schedule}
      />
    </Stack>
  );
}
