"use client";

import {
  Button,
  CheckboxInput,
  Glyph,
  Grid,
  GridColumn,
  GridSystem,
  HStack,
  LocationSelector,
  NumberInput,
  ProgressBar,
  RadioList,
  RadioListItem,
  SegmentedControl,
  SegmentedControlItem,
  Selector,
  Stack,
  Sticky,
  Text,
  TextArea,
  TextInput,
  Tokenizer,
  createStaticSource,
  useToast,
  type SearchableItem,
} from "@openseat/design-system";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { JobAiPaste, type ParsedJob } from "@/components/company/post-job/job-ai-paste";
import { ScreeningQuestionsEditor } from "@/components/company/post-job/screening-questions-editor";
import { JobTeamField, JobTeamList } from "@/components/company/post-job/job-team-field";
import { JobResultCard } from "@/components/jobs/job-result-card";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { createJob, fetchJob, fetchJobTeams, fetchSettings, updateJob } from "@/lib/company/api";
import {
  ASSISTED_POLICIES,
  DEFAULT_DAILY_CAP,
  MAX_DAILY_CAP,
  POLICY_META,
  type AssistedPolicy,
  type CompanyJob,
} from "@/lib/company";
import { hydrateScreeningQuestions, type ScreeningQuestion } from "@/lib/intake";
import type { AuthCompany } from "@/lib/auth/types";
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  SENIORITY_OPTIONS,
  WORKPLACE_OPTIONS,
  type Job,
  type Seniority,
  type Workplace,
} from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";

const SKILL_SUGGESTIONS = [
  "Figma",
  "Design systems",
  "Prototyping",
  "User research",
  "SQL",
  "Python",
  "Accessibility",
  "Stakeholder management",
];
const PAY_STEP = 5_000;
const DEFAULT_PAY = { min: 130_000, max: 160_000 };
const SUMMARY_ROWS = 4;
const DESCRIPTION_ROWS = 10;
const FIELD_MIN_WIDTH = 160;
const PREVIEW_SCORE = 90;
const PERCENT = 100;

type Draft = {
  title: string;
  team: string;
  seniority: Seniority;
  location: string;
  workplace: Workplace;
  payMin: number;
  payMax: number;
  currency: string;
  visa: boolean;
  summary: string;
  skills: SearchableItem[];
  responsibilities: SearchableItem[];
  requirements: SearchableItem[];
  description: string;
  policy: AssistedPolicy;
  dailyCap: number;
  screeningQuestions: ScreeningQuestion[];
};

const EMPTY: Draft = {
  title: "",
  team: "",
  seniority: "Middle",
  location: "",
  workplace: "hybrid",
  payMin: DEFAULT_PAY.min,
  payMax: DEFAULT_PAY.max,
  currency: DEFAULT_CURRENCY,
  visa: false,
  summary: "",
  skills: [],
  responsibilities: [],
  requirements: [],
  description: "",
  policy: "accept",
  dailyCap: DEFAULT_DAILY_CAP,
  screeningQuestions: [],
};

function toItems(labels: string[]): SearchableItem[] {
  return labels.filter(Boolean).map((label) => ({ id: label, label }));
}

function jobToDraft(job: CompanyJob): Draft {
  return {
    title: job.title,
    team: job.team,
    seniority: job.seniority,
    location: job.location,
    workplace: job.workplace,
    payMin: job.payMin,
    payMax: job.payMax,
    currency: job.currency || DEFAULT_CURRENCY,
    visa: job.visa,
    summary: job.summary,
    skills: toItems(job.skills),
    responsibilities: toItems(job.responsibilities),
    requirements: toItems(job.requirements),
    description: job.description,
    policy: job.policy,
    dailyCap: job.dailyCap && job.dailyCap > 0 ? job.dailyCap : DEFAULT_DAILY_CAP,
    screeningQuestions: hydrateScreeningQuestions(job.screeningQuestions),
  };
}

function parsedToDraft(parsed: ParsedJob, current: Draft): Draft {
  return {
    ...current,
    title: parsed.title || current.title,
    team: parsed.team || current.team,
    seniority: parsed.seniority || current.seniority,
    location: parsed.location || current.location,
    workplace: parsed.workplace || current.workplace,
    payMin: parsed.payMin || current.payMin,
    payMax: parsed.payMax || current.payMax,
    currency: parsed.currency || current.currency,
    visa: parsed.visa,
    summary: parsed.summary || current.summary,
    skills: parsed.skills.length ? toItems(parsed.skills) : current.skills,
    responsibilities: parsed.responsibilities.length
      ? toItems(parsed.responsibilities)
      : current.responsibilities,
    requirements: parsed.requirements.length ? toItems(parsed.requirements) : current.requirements,
    description: parsed.description || current.description,
  };
}

/** The job as candidates will see it in search, built from the draft. */
function toPreviewJob(draft: Draft, company: AuthCompany): Job {
  return {
    id: "draft",
    title: draft.title || "Job title",
    company: company.name,
    companyId: company.id,
    location: draft.location || "Location",
    workplace: draft.workplace,
    pay: {
      min: draft.payMin,
      max: draft.payMax,
      currency: draft.currency || DEFAULT_CURRENCY,
      period: "year",
    },
    seniority: draft.seniority,
    employment: "full-time",
    postedHoursAgo: 0,
    source: "direct",
    visa: draft.visa,
    applicants: 0,
    team: draft.team,
    skills: draft.skills.map((skill) => skill.label),
    summary: draft.summary,
    responsibilities: draft.responsibilities.map((item) => item.label),
    requirements: draft.requirements.map((item) => item.label),
    benefits: [],
    description: draft.description || undefined,
  };
}

/** Write a job on the left, watch its search card update on the right, publish when ready. */
export function JobPostEditor({
  company,
  canEditTeams,
  jobId,
}: {
  company: AuthCompany;
  canEditTeams: boolean;
  jobId?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [teams, setTeams] = useState<string[]>([]);
  const [status, setStatus] = useState<CompanyJob["status"]>("draft");
  const [saving, setSaving] = useState(false);
  const assistedTouched = useRef(false);
  const skillSource = useMemo(
    () => createStaticSource(SKILL_SUGGESTIONS.map((label) => ({ id: label, label }))),
    [],
  );
  const listSource = useMemo(() => createStaticSource([]), []);
  const set =
    <K extends keyof Draft>(key: K) =>
    (value: Draft[K]) =>
      setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let active = true;
    fetchJobTeams()
      .then((loaded) => {
        if (active) setTeams(loaded);
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    if (jobId) {
      fetchJob(jobId)
        .then((job) => {
          if (!active) return;
          setDraft(jobToDraft(job));
          setStatus(job.status);
        })
        .catch((error: Error) => toast({ body: error.message, type: "error" }));
    } else {
      fetchSettings()
        .then((settings) => {
          if (!active || assistedTouched.current) return;
          setDraft((current) => ({
            ...current,
            policy: settings.policy,
            dailyCap: settings.dailyCap > 0 ? settings.dailyCap : current.dailyCap,
          }));
        })
        .catch((error: Error) => toast({ body: error.message, type: "error" }));
    }
    return () => {
      active = false;
    };
  }, [jobId, toast]);

  const checks = [
    { label: "Title", done: draft.title.trim().length > 0 },
    { label: "Location", done: draft.location.trim().length > 0 },
    { label: "Pay range", done: draft.payMax >= draft.payMin && draft.payMin > 0 },
    { label: "Summary", done: draft.summary.trim().length > 0 },
    { label: "At least 3 skills", done: draft.skills.length >= 3 },
  ];
  const done = checks.filter((check) => check.done).length;
  const ready = checks.every((check) => check.done);

  const payload = (nextStatus: "draft" | "open" | "paused") => ({
    title: draft.title,
    team: draft.team,
    seniority: draft.seniority,
    location: draft.location,
    workplace: draft.workplace,
    payMin: draft.payMin,
    payMax: draft.payMax,
    currency: draft.currency,
    visa: draft.visa,
    summary: draft.summary,
    skills: draft.skills.map((skill) => skill.label),
    responsibilities: draft.responsibilities.map((item) => item.label),
    requirements: draft.requirements.map((item) => item.label),
    description: draft.description,
    screeningQuestions: draft.screeningQuestions
      .map((item) => ({
        ...item,
        prompt: item.prompt.trim(),
      }))
      .filter((item) => item.prompt.length > 0),
    policy: draft.policy,
    dailyCap: draft.dailyCap,
    status: nextStatus,
  });

  const save = (nextStatus: "draft" | "open" | "paused") => {
    setSaving(true);
    const send = jobId ? updateJob(jobId, payload(nextStatus)) : createJob(payload(nextStatus));
    send
      .then(() => {
        toast({
          body:
            nextStatus === "open"
              ? `${draft.title} is live. Posting is free.`
              : nextStatus === "paused"
                ? "Job saved"
                : "Draft saved",
        });
        router.push(ROUTES.companyJobs);
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }))
      .finally(() => setSaving(false));
  };

  const currency = CURRENCY_OPTIONS.some((option) => option.value === draft.currency)
    ? draft.currency
    : DEFAULT_CURRENCY;

  return (
    <GridSystem gap={6} align="start">
      <GridColumn span="full" lg={7}>
        <Stack gap={6}>
          <JobAiPaste
            onParsed={(parsed) => {
              setDraft((current) => parsedToDraft(parsed, current));
              if (parsed.team.trim()) {
                setTeams((current) =>
                  current.some((team) => team.toLowerCase() === parsed.team.toLowerCase())
                    ? current
                    : [...current, parsed.team.trim()],
                );
              }
            }}
          />

          <SettingsGroup title="The role" description="What candidates search for.">
            <TextInput
              label="Job title"
              value={draft.title}
              onChange={set("title")}
              isRequired
              placeholder="Product Designer"
            />
            <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={3}>
              <JobTeamField
                value={draft.team}
                teams={teams}
                canEditTeams={canEditTeams}
                onChange={set("team")}
                onTeams={setTeams}
              />
              <Selector
                label="Seniority"
                options={SENIORITY_OPTIONS}
                value={draft.seniority}
                onChange={(value) => set("seniority")(value as Seniority)}
              />
            </Grid>
            <JobTeamList
              value={draft.team}
              teams={teams}
              canEditTeams={canEditTeams}
              onChange={set("team")}
              onTeams={setTeams}
            />
          </SettingsGroup>

          <SettingsGroup
            title="Place and pay"
            description="Jobs with a pay range get about twice the applicants."
          >
            <SettingsRow label="Workplace">
              <SegmentedControl
                label="Workplace"
                value={draft.workplace}
                onChange={(value) => set("workplace")(value as Workplace)}
                layout="fill"
              >
                {WORKPLACE_OPTIONS.map((option) => (
                  <SegmentedControlItem
                    key={option.value}
                    value={option.value}
                    label={option.label}
                  />
                ))}
              </SegmentedControl>
            </SettingsRow>
            <SettingsRow label="Location">
              <LocationSelector
                label="Location"
                isLabelHidden
                value={draft.location}
                onChange={set("location")}
              />
            </SettingsRow>
            <SettingsRow label="Pay range" description="Yearly base.">
              <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={3}>
                <NumberInput
                  label="From"
                  value={draft.payMin}
                  onChange={(value) => set("payMin")(value ?? 0)}
                  min={0}
                  step={PAY_STEP}
                  isIntegerOnly
                  units={currency}
                />
                <NumberInput
                  label="To"
                  value={draft.payMax}
                  onChange={(value) => set("payMax")(value ?? 0)}
                  min={0}
                  step={PAY_STEP}
                  isIntegerOnly
                  units={currency}
                />
                <Selector
                  label="Currency"
                  options={CURRENCY_OPTIONS}
                  value={currency}
                  onChange={set("currency")}
                />
              </Grid>
            </SettingsRow>
            <CheckboxInput
              label="We sponsor visas for this role"
              value={draft.visa}
              onChange={set("visa")}
            />
          </SettingsGroup>

          <SettingsGroup title="Description">
            <TextArea
              label="Summary"
              description="About the role, in a short paragraph."
              value={draft.summary}
              onChange={set("summary")}
              rows={SUMMARY_ROWS}
            />
            <Tokenizer
              label="What you’ll do"
              description="The work, as candidates will read it."
              searchSource={listSource}
              value={draft.responsibilities}
              onChange={set("responsibilities")}
              maxEntries={6}
              hasCreate
              placeholder="Add a responsibility"
            />
            <Tokenizer
              label="What you’ll need"
              description="What you’ll bring."
              searchSource={listSource}
              value={draft.requirements}
              onChange={set("requirements")}
              maxEntries={6}
              hasCreate
              placeholder="Add a requirement"
            />
            <TextArea
              label="Full job description"
              description="The complete posting. Candidates can open this under More details."
              value={draft.description}
              onChange={set("description")}
              rows={DESCRIPTION_ROWS}
            />
            <Tokenizer
              label="Skills"
              description="Used to score each candidate’s fit."
              searchSource={skillSource}
              value={draft.skills}
              onChange={set("skills")}
              hasCreate
              hasEntriesOnFocus
              placeholder="Add a skill"
            />
          </SettingsGroup>

          <SettingsGroup
            title="Assisted applications"
            description="Starts from your company defaults. This job can use something else."
          >
            <RadioList
              label="Assisted applications"
              value={draft.policy}
              onChange={(value) => {
                assistedTouched.current = true;
                set("policy")(value as AssistedPolicy);
              }}
            >
              {ASSISTED_POLICIES.map((value) => (
                <RadioListItem
                  key={value}
                  value={value}
                  label={POLICY_META[value].label}
                  description={POLICY_META[value].description}
                />
              ))}
            </RadioList>
            <SettingsRow label="Daily cap" description="Assisted applications accepted per day.">
              <NumberInput
                label="Daily cap"
                isLabelHidden
                value={draft.dailyCap}
                onChange={(value) => {
                  assistedTouched.current = true;
                  set("dailyCap")(value ?? DEFAULT_DAILY_CAP);
                }}
                min={1}
                max={MAX_DAILY_CAP}
                isIntegerOnly
                isDisabled={draft.policy !== "cap"}
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup
            title="Screening questions"
            description="Asked on apply. Knockout answers flag the candidate in the applicants drawer."
          >
            <ScreeningQuestionsEditor
              value={draft.screeningQuestions}
              onChange={set("screeningQuestions")}
            />
          </SettingsGroup>
        </Stack>
      </GridColumn>

      <GridColumn span="full" lg={5}>
        <Sticky offset={4}>
          <Stack gap={4}>
            <Text type="label">Preview in search</Text>
            <JobResultCard
              job={toPreviewJob(draft, company)}
              score={PREVIEW_SCORE}
              selected={false}
              saved={false}
              applied={false}
              onSelect={() => {}}
              onToggleSave={() => {}}
            />
            <Stack gap={3}>
              <HStack hAlign="between">
                <Text type="label">Ready to publish</Text>
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {done} of {checks.length}
                </Text>
              </HStack>
              <ProgressBar
                label="Ready to publish"
                isLabelHidden
                value={(done / checks.length) * PERCENT}
                variant={ready ? "success" : "accent"}
              />
              <Stack gap={1}>
                {checks.map((check) => (
                  <HStack key={check.label} gap={2} vAlign="center">
                    <Text color={check.done ? "accent" : "disabled"}>
                      <Glyph name={check.done ? "check" : "dot"} />
                    </Text>
                    <Text type="supporting" color={check.done ? "primary" : "secondary"}>
                      {check.label}
                    </Text>
                  </HStack>
                ))}
              </Stack>
            </Stack>
            <HStack gap={2}>
              {status === "open" ? (
                <Button
                  label="Save"
                  variant="primary"
                  isDisabled={!ready || saving}
                  onClick={() => save("open")}
                />
              ) : (
                <>
                  <Button
                    label="Save draft"
                    variant="secondary"
                    isDisabled={!draft.title.trim() || saving}
                    onClick={() => save(status === "paused" ? "paused" : "draft")}
                  />
                  <Button
                    label="Publish job"
                    variant="primary"
                    isDisabled={!ready || saving}
                    onClick={() => save("open")}
                  />
                </>
              )}
            </HStack>
          </Stack>
        </Sticky>
      </GridColumn>
    </GridSystem>
  );
}
