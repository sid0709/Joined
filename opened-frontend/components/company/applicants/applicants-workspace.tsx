"use client";

import { useEffect, useMemo, useState } from "react";
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
import { canAdvanceStage } from "@/components/company/pipeline/feedback-gate";
import {
  fetchApplicantScorecards,
  fetchApplicants,
  fetchHiringProfile,
  fetchJobs,
  fetchTeam,
  moveApplicant,
  scheduleInterview,
  stageMoveErrorMessage,
  submitApplicantScorecard,
} from "@/lib/company/api";
import {
  APPLICANT_STAGES,
  DEFAULT_FEEDBACK_GATE,
  EMPTY_HIRING_PROFILE,
  STRONG_FIT,
  buildApplicantColumns,
  stageLabel,
  unionCustomStages,
  type Applicant,
  type ApplicantColumnId,
  type CompanyJob,
  type HiringProfile,
  type PipelineStageDef,
  type ScorecardSubmission,
  type ScorecardSubmissionInput,
  type TeamMember,
  type TeamRole,
} from "@/lib/company";
import { ApplicantCard } from "./applicant-card";
import { ApplicantDrawer, type ApplicantScheduleRequest } from "./applicant-drawer";
import type { OfferActionResult } from "@/components/company/offer/offer-panel";
import { applyOfferStatus, buildOfferPatch, defaultOfferTemplates } from "@/lib/offer-hire";
import { isBadRequestError, isForbiddenError } from "@/lib/me/client";
import { canPermission, denialReason } from "@/lib/rbac";

const COLUMN_WIDTH = 240;
const PERCENT = 100;
const SEARCH_WIDTH = 240;
const ALL_JOBS = "all";
const ALL_TAGS = "all";

/** The hiring pipeline: filter, drag candidates between stages, open one to decide. */
export function ApplicantsWorkspace({ actorRole = null }: { actorRole?: TeamRole | null }) {
  const toast = useToast();
  const canMoveApplicants = canPermission(actorRole, "applicants.move");
  const canHire = canPermission(actorRole, "offers.hire");
  const canSchedule = canPermission(actorRole, "interviews.schedule");
  // Einstein: stage moves need applicants.move; hired needs offers.hire; schedule needs interviews.schedule.
  const [people, setPeople] = useState<Applicant[]>([]);
  const [jobs, setJobs] = useState<CompanyJob[]>([]);
  const [jobOptions, setJobOptions] = useState([{ value: ALL_JOBS, label: "All jobs" }]);
  const [jobId, setJobId] = useState(ALL_JOBS);
  const [query, setQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState(ALL_TAGS);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [hiringProfile, setHiringProfile] = useState<HiringProfile | null>(null);
  const [scorecards, setScorecards] = useState<ScorecardSubmission[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchApplicants(), fetchJobs()])
      .then(([nextPeople, nextJobs]) => {
        if (!active) return;
        setPeople(nextPeople);
        setJobs(nextJobs);
        setJobOptions([
          { value: ALL_JOBS, label: "All jobs" },
          ...nextJobs
            .filter((job) => job.status !== "draft")
            .map((job) => ({ value: job.id, label: job.title })),
        ]);
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    fetchTeam()
      .then((team) => {
        if (active) setTeamMembers(team.members ?? []);
      })
      .catch(() => {
        /* Interviewer assign degrades without team; applicants still load. */
      });
    fetchHiringProfile()
      .then((profile) => {
        if (active) setHiringProfile(profile ?? EMPTY_HIRING_PROFILE);
      })
      .catch(() => {
        if (active) setHiringProfile(EMPTY_HIRING_PROFILE);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  useEffect(() => {
    if (!openId) return;
    let active = true;
    fetchApplicantScorecards(openId)
      .then((items) => {
        if (!active) return;
        setScorecards((current) => {
          const others = current.filter((item) => item.applicantId !== openId);
          return [...items, ...others];
        });
      })
      .catch(() => {
        /* Gate still runs client-side; empty list until retry. */
      });
    return () => {
      active = false;
    };
  }, [openId]);

  const openApplicant = people.find((person) => person.id === openId) ?? null;
  const activeJob = useMemo(() => {
    const id = openApplicant?.jobId ?? (jobId !== ALL_JOBS ? jobId : null);
    return jobs.find((job) => job.id === id) ?? null;
  }, [jobs, openApplicant, jobId]);
  const feedbackGate = activeJob?.feedbackGate ?? DEFAULT_FEEDBACK_GATE;
  const scorecardTemplate = activeJob?.scorecardTemplate ?? null;
  const interviewGuide = activeJob?.interviewGuide ?? null;
  const offerTemplates =
    activeJob?.offerTemplates && activeJob.offerTemplates.length > 0
      ? activeJob.offerTemplates
      : defaultOfferTemplates();

  // Board columns: selected job → that job's customStages; "All jobs" → union of
  // custom stages across loaded jobs (fixed six when none). Avoids hiding cards
  // that sit on a per-job custom stage while still keeping one shared board.
  const boardCustomStages: PipelineStageDef[] = useMemo(() => {
    if (jobId !== ALL_JOBS) {
      const job = jobs.find((item) => item.id === jobId);
      return job?.customStages ?? [];
    }
    return unionCustomStages(jobs);
  }, [jobId, jobs]);
  const boardColumns = useMemo(
    () => buildApplicantColumns(APPLICANT_STAGES, boardCustomStages),
    [boardCustomStages],
  );

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
    const prior = people.find((person) => person.id === next.id);
    if (prior && prior.columnId !== next.columnId) {
      const needed = next.columnId === "hired" ? "offers.hire" : "applicants.move";
      if (!canPermission(actorRole, needed)) {
        toast({ body: denialReason(actorRole, needed), type: "error" });
        return;
      }
    }
    const offerPatch = next.offer ? buildOfferPatch(next.offer) : undefined;
    // When advancing straight to hired without OfferPanel, stamp accepted.
    const patchedOffer =
      next.columnId === "hired" && next.offer && next.offer.status !== "accepted"
        ? buildOfferPatch(applyOfferStatus(next.offer, "accepted"))
        : next.columnId === "hired" && !next.offer
          ? buildOfferPatch(applyOfferStatus(undefined, "accepted"))
          : offerPatch;
    moveApplicant(
      next.id,
      next.columnId,
      next.notes,
      next.rating,
      next.tags,
      next.interviewerIds,
      patchedOffer,
    )
      .then((saved) => {
        setPeople((current) =>
          current.map((person) =>
            person.id === saved.id
              ? {
                  ...saved,
                  interviewerIds: next.interviewerIds ?? saved.interviewerIds,
                  offer: next.offer ?? saved.offer,
                }
              : person,
          ),
        );
        if (message) {
          toast({ body: message });
          setOpenId(null);
        }
      })
      .catch((error: unknown) => toast({ body: stageMoveErrorMessage(error), type: "error" }));
  };

  const applyOffer = (result: OfferActionResult) => {
    const nextColumn = result.columnId ?? result.applicant.columnId;
    // Hired moves still respect the feedback gate via replace → tryMove is drawer-side;
    // here OfferPanel already decided status — persist offer + optional column.
    if (result.columnId && result.columnId !== result.applicant.columnId) {
      const gate = feedbackGate;
      const check = canAdvanceStage({
        fromStage: result.applicant.columnId,
        toStage: result.columnId,
        notes: result.applicant.notes,
        rating: result.applicant.rating,
        hasScorecard: scorecards.some((item) => item.applicantId === result.applicant.id),
        gate,
        customStages: activeJob?.customStages,
      });
      if (!check.ok) {
        toast({ body: check.reason, type: "error" });
        return;
      }
    }
    replace({ ...result.applicant, columnId: nextColumn, offer: result.offer }, result.message);
  };

  const schedule = (person: Applicant, slot: ApplicantScheduleRequest) => {
    if (!canSchedule) {
      toast({ body: denialReason(actorRole, "interviews.schedule"), type: "error" });
      return;
    }
    const meetingUrl = hiringProfile?.meetingLink?.trim() || undefined;
    const primary =
      slot.mode === "propose" && slot.proposedSlots[0]
        ? slot.proposedSlots[0]
        : { date: slot.date, start: slot.start, end: slot.end };
    scheduleInterview({
      applicationId: person.id,
      round: slot.round,
      date: primary.date,
      start: primary.start,
      end: primary.end,
      format: "video",
      interviewers: slot.interviewerNames,
      where: meetingUrl,
      meetingUrl,
      mode: slot.mode,
      proposedSlots: slot.mode === "propose" ? slot.proposedSlots : undefined,
      selfSchedule: slot.mode === "self_schedule",
    })
      .then((created) => {
        setPeople((current) =>
          current.map((item) =>
            item.id === person.id
              ? { ...item, columnId: "interview", interviewerIds: slot.interviewerIds }
              : item,
          ),
        );
        const body =
          slot.mode === "propose"
            ? `Offered times to ${person.name}. Round is awaiting until a slot is locked.`
            : slot.mode === "self_schedule"
              ? created.selfScheduleUrl
                ? `Self-schedule link ready for ${person.name}. Copy it from Interviews.`
                : `Self-schedule sent to ${person.name}. Round is awaiting a pick.`
              : `Scheduled ${person.name}. The interview price was taken from your balance.`;
        toast({ body });
        setOpenId(null);
      })
      .catch((error: unknown) => {
        const message =
          isForbiddenError(error) || isBadRequestError(error)
            ? error.message || denialReason(actorRole, "interviews.schedule")
            : error instanceof Error && error.message
              ? error.message
              : "Could not schedule this interview.";
        toast({ body: message, type: "error" });
      });
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
        columns={boardColumns}
        items={visible}
        onItemsChange={(next, move) => {
          const hidden = people.filter(
            (person) => !visible.some((shown) => shown.id === person.id),
          );
          const moved = next.find((person) => person.id === move.itemId);
          if (move.from.columnId !== move.to.columnId && moved) {
            const toStage = move.to.columnId as ApplicantColumnId;
            const needed = toStage === "hired" ? "offers.hire" : "applicants.move";
            if (!canPermission(actorRole, needed)) {
              toast({ body: denialReason(actorRole, needed), type: "error" });
              return;
            }
            const job = jobs.find((item) => item.id === moved.jobId);
            const gate = job?.feedbackGate ?? DEFAULT_FEEDBACK_GATE;
            const check = canAdvanceStage({
              fromStage: move.from.columnId,
              toStage: move.to.columnId,
              notes: moved.notes,
              rating: moved.rating,
              hasScorecard: scorecards.some((item) => item.applicantId === moved.id),
              gate,
              customStages: job?.customStages,
            });
            if (!check.ok) {
              toast({ body: check.reason, type: "error" });
              return;
            }
            const jobCustom = job?.customStages;
            let stampOffer = moved.offer;
            let offerPatch = undefined as ReturnType<typeof buildOfferPatch> | undefined;
            if (toStage === "offer" && !stampOffer) {
              stampOffer = applyOfferStatus(undefined, "draft");
              offerPatch = buildOfferPatch(stampOffer);
            } else if (toStage === "hired") {
              stampOffer = applyOfferStatus(stampOffer, "accepted");
              offerPatch = buildOfferPatch(stampOffer);
            } else if (stampOffer) {
              offerPatch = buildOfferPatch(stampOffer);
            }
            setPeople([
              ...hidden,
              ...next.map((person) =>
                person.id === moved.id ? { ...person, offer: stampOffer ?? person.offer } : person,
              ),
            ]);
            moveApplicant(moved.id, toStage, undefined, undefined, undefined, undefined, offerPatch)
              .then((saved) => {
                setPeople((current) =>
                  current.map((person) =>
                    person.id === saved.id
                      ? { ...saved, offer: stampOffer ?? saved.offer }
                      : person,
                  ),
                );
                toast({
                  body: `Moved to ${stageLabel(toStage, jobCustom, APPLICANT_STAGES)}`,
                });
              })
              .catch((error: unknown) => {
                setPeople(people);
                toast({ body: stageMoveErrorMessage(error), type: "error" });
              });
            return;
          }
          setPeople([...hidden, ...next]);
        }}
        getItemLabel={(person) => `${person.name}, ${person.fit}% fit`}
        renderItem={(person) => (
          <ApplicantCard applicant={person} onOpen={() => setOpenId(person.id)} />
        )}
        columnWidth={COLUMN_WIDTH}
        emptyText="Drop a candidate here"
      />

      <ApplicantDrawer
        applicant={openApplicant}
        allApplicants={people}
        teamMembers={teamMembers}
        actorRole={actorRole}
        canMove={canMoveApplicants}
        canHire={canHire}
        canSchedule={canSchedule}
        hiringProfile={hiringProfile}
        scorecardTemplate={scorecardTemplate}
        interviewGuide={interviewGuide}
        feedbackGate={feedbackGate}
        customStages={activeJob?.customStages}
        scorecards={scorecards}
        offerTemplates={offerTemplates}
        onScorecard={async (input: ScorecardSubmissionInput) => {
          if (!openApplicant) return;
          try {
            const saved = await submitApplicantScorecard(openApplicant.id, input);
            setScorecards((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
            toast({ body: "Scorecard submitted." });
          } catch (error) {
            toast({
              body: error instanceof Error ? error.message : "Could not submit scorecard.",
              type: "error",
            });
            throw error;
          }
        }}
        onClose={() => setOpenId(null)}
        onChange={replace}
        onSchedule={schedule}
        onOffer={applyOffer}
      />
    </Stack>
  );
}
