"use client";

import { useMemo, useState } from "react";
import {
  Button,
  CheckboxInput,
  Glyph,
  Grid,
  GridColumn,
  GridSystem,
  HStack,
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
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { JobResultCard } from "@/components/jobs/job-result-card";
import { POLICY_META, WORKSPACE, type AssistedPolicy } from "@/lib/company";
import type { Job, Seniority, Workplace } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";

const WORKPLACES: { value: Workplace; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];
const SENIORITY: Seniority[] = ["Junior", "Middle", "Senior", "Leader", "Manager"];
const TEAMS = ["Design", "Data", "Engineering", "Operations"].map((value) => ({
  value,
  label: value,
}));
const POLICIES = Object.keys(POLICY_META) as AssistedPolicy[];
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
const FIELD_MIN_WIDTH = 160;
const PREVIEW_SCORE = 90;
const CURRENCY = "USD";
const PERCENT = 100;

type Draft = {
  title: string;
  team: string;
  seniority: Seniority;
  location: string;
  workplace: Workplace;
  payMin: number;
  payMax: number;
  visa: boolean;
  summary: string;
  skills: SearchableItem[];
  policy: AssistedPolicy;
};

const EMPTY: Draft = {
  title: "",
  team: TEAMS[0].value,
  seniority: "Middle",
  location: "",
  workplace: "hybrid",
  payMin: DEFAULT_PAY.min,
  payMax: DEFAULT_PAY.max,
  visa: false,
  summary: "",
  skills: [],
  policy: "accept",
};

/** The job as candidates will see it in search, built from the draft. */
function toPreviewJob(draft: Draft): Job {
  return {
    id: "draft",
    title: draft.title || "Job title",
    company: WORKSPACE.name,
    companyId: WORKSPACE.slug,
    location: draft.location || "Location",
    workplace: draft.workplace,
    pay: { min: draft.payMin, max: draft.payMax, currency: CURRENCY, period: "year" },
    seniority: draft.seniority,
    employment: "full-time",
    postedHoursAgo: 0,
    source: "direct",
    visa: draft.visa,
    applicants: 0,
    team: draft.team,
    skills: draft.skills.map((skill) => skill.label),
    summary: draft.summary,
    responsibilities: [],
    requirements: [],
    benefits: [],
  };
}

/** Write a job on the left, watch its search card update on the right, publish when ready. */
export function JobPostEditor() {
  const toast = useToast();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const skillSource = useMemo(
    () => createStaticSource(SKILL_SUGGESTIONS.map((label) => ({ id: label, label }))),
    [],
  );
  const set =
    <K extends keyof Draft>(key: K) =>
    (value: Draft[K]) =>
      setDraft((current) => ({ ...current, [key]: value }));

  const checks = [
    { label: "Title", done: draft.title.trim().length > 0 },
    { label: "Location", done: draft.location.trim().length > 0 },
    { label: "Pay range", done: draft.payMax >= draft.payMin && draft.payMin > 0 },
    { label: "Summary", done: draft.summary.trim().length > 0 },
    { label: "At least 3 skills", done: draft.skills.length >= 3 },
  ];
  const done = checks.filter((check) => check.done).length;
  const ready = checks.every((check) => check.done);

  return (
    <GridSystem gap={6} align="start">
      <GridColumn span="full" lg={7}>
        <Stack gap={6}>
          <SettingsGroup title="The role" description="What candidates search for.">
            <TextInput
              label="Job title"
              value={draft.title}
              onChange={set("title")}
              isRequired
              placeholder="Product Designer"
            />
            <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={3}>
              <Selector label="Team" options={TEAMS} value={draft.team} onChange={set("team")} />
              <Selector
                label="Seniority"
                options={SENIORITY.map((value) => ({ value, label: value }))}
                value={draft.seniority}
                onChange={(value) => set("seniority")(value as Seniority)}
              />
            </Grid>
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
                {WORKPLACES.map((option) => (
                  <SegmentedControlItem
                    key={option.value}
                    value={option.value}
                    label={option.label}
                  />
                ))}
              </SegmentedControl>
            </SettingsRow>
            <SettingsRow label="Location">
              <TextInput
                label="Location"
                isLabelHidden
                value={draft.location}
                onChange={set("location")}
                placeholder="Chicago"
              />
            </SettingsRow>
            <SettingsRow label="Pay range" description="Yearly base, in USD.">
              <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={3}>
                <NumberInput
                  label="From"
                  value={draft.payMin}
                  onChange={set("payMin")}
                  min={0}
                  step={PAY_STEP}
                  isIntegerOnly
                  units={CURRENCY}
                />
                <NumberInput
                  label="To"
                  value={draft.payMax}
                  onChange={set("payMax")}
                  min={0}
                  step={PAY_STEP}
                  isIntegerOnly
                  units={CURRENCY}
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
              description="What the person will do in their first three months."
              value={draft.summary}
              onChange={set("summary")}
              rows={SUMMARY_ROWS}
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

          <SettingsGroup title="Who can apply">
            <RadioList
              label="Assisted applications"
              value={draft.policy}
              onChange={(value) => set("policy")(value as AssistedPolicy)}
            >
              {POLICIES.map((value) => (
                <RadioListItem
                  key={value}
                  value={value}
                  label={POLICY_META[value].label}
                  description={POLICY_META[value].description}
                />
              ))}
            </RadioList>
          </SettingsGroup>
        </Stack>
      </GridColumn>

      <GridColumn span="full" lg={5}>
        <Sticky offset={4}>
          <Stack gap={4}>
            <Text type="label">Preview in search</Text>
            <JobResultCard
              job={toPreviewJob(draft)}
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
              <Button
                label="Save draft"
                variant="secondary"
                isDisabled={!draft.title.trim()}
                onClick={() => toast({ body: "Draft saved" })}
              />
              <Button
                label="Publish job"
                variant="primary"
                isDisabled={!ready}
                onClick={() => {
                  toast({ body: `${draft.title} is live. Posting is free.` });
                  router.push(ROUTES.companyJobs);
                }}
              />
            </HStack>
          </Stack>
        </Sticky>
      </GridColumn>
    </GridSystem>
  );
}
