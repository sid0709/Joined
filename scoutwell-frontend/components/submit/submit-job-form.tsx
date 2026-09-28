"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  GridColumn,
  GridSystem,
  HStack,
  List,
  ListItem,
  NumberInput,
  Selector,
  Stack,
  Sticky,
  Switch,
  Text,
  TextArea,
  TextInput,
  useToast,
  PageHeader,
  SectionCard,
} from "@openseat/design-system";
import {
  ApiError,
  DEFAULT_CURRENCY,
  EMPLOYMENT_LABEL,
  PAY_PERIOD_OPTIONS,
  SENIORITY_LABEL,
  WORKPLACE_LABEL,
  options,
  type Employment,
  type LevelRule,
  type Limits,
  type PayPeriod,
  type Quota,
  type Seniority,
  type Submission,
  type Workplace,
} from "@openseat/scout";
import { FullText } from "@/components/full-text";
import { SUGGESTED_TAGS } from "@/lib/config";
import { formatCount, parseList, parseTags } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { scoutSend } from "@/lib/scout/client";
import { CompanyField, type CompanyChoice } from "./company-field";
import { PrecheckCard } from "./precheck-card";
import { usePrecheck } from "./use-precheck";

/** Blank means "let the API infer it from the title, location, and tags". */
const INFER = "";
const PAY_YEAR_STEP = 5_000;
const PAY_HOUR_STEP = 1;

type Form = {
  url: string;
  company: CompanyChoice | null;
  title: string;
  locationText: string;
  workplace: Workplace | "";
  employment: Employment | "";
  seniority: Seniority | "";
  payMin: number;
  payMax: number;
  payPeriod: PayPeriod;
  summary: string;
  tags: string;
  skills: string;
  onMajorBoards: boolean;
};

const EMPTY: Form = {
  url: "",
  company: null,
  title: "",
  locationText: "",
  workplace: INFER,
  employment: INFER,
  seniority: INFER,
  payMin: 0,
  payMax: 0,
  payPeriod: "year",
  summary: "",
  tags: "",
  skills: "",
  onMajorBoards: false,
};

function withInfer<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return [{ value: INFER, label: "Detect automatically" }, ...options(values, labels)];
}

export function SubmitJobForm({
  quota,
  level,
  limits,
}: {
  quota: Quota;
  level: LevelRule;
  limits: Limits;
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<ApiError | null>(null);
  // One key per attempt: a retry after a network blip can never create two submissions.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const precheck = usePrecheck(form.url);

  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
      setIdempotencyKey(crypto.randomUUID());
    };
  const status = (field: string) => {
    const message = error?.field(field);
    return message ? { type: "error" as const, message } : undefined;
  };

  const summaryLength = form.summary.trim().length;
  const payInvalid = form.payMax > 0 && form.payMin > form.payMax;
  const blocked =
    precheck.phase === "done" &&
    (!precheck.result.official || Boolean(precheck.result.duplicate_of));
  const ready =
    Boolean(form.url.trim() && form.company && form.title.trim()) &&
    !payInvalid &&
    summaryLength >= limits.min_summary_chars &&
    summaryLength <= limits.max_summary_chars &&
    quota.remaining > 0;

  const submit = async () => {
    setError(null);
    try {
      const created = await scoutSend<Submission>(
        "/submissions",
        "POST",
        {
          url: form.url,
          company_name: form.company?.name ?? "",
          company_id: form.company?.id ?? "",
          title: form.title,
          location_text: form.locationText,
          workplace: form.workplace,
          employment: form.employment,
          seniority: form.seniority,
          pay: {
            min: form.payMin,
            max: form.payMax,
            currency: DEFAULT_CURRENCY,
            period: form.payPeriod,
          },
          salary: "",
          summary: form.summary,
          tags: parseTags(form.tags),
          skills: parseList(form.skills),
          on_major_boards: form.onMajorBoards,
        },
        { "Idempotency-Key": idempotencyKey },
      );
      toast({ body: "Submitted. Checks are running now." });
      router.push(ROUTES.submission(created.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
      if (!(err instanceof ApiError))
        toast({ body: "Could not submit. Try again.", type: "error" });
    }
  };

  return (
    <Stack gap={6}>
      <PageHeader
        title="Submit a job"
        description="An official opening that is not already in the pool. You earn when people use it."
      />
      {quota.remaining === 0 ? (
        <Banner
          status="info"
          title="Daily limit reached"
          description={`${level.label} scouts can submit ${quota.limit} jobs a day. The limit resets at midnight UTC.`}
        />
      ) : null}
      {error ? <Banner status="error" title={error.message} /> : null}
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={8}>
          <Stack gap={6}>
            <SectionCard
              title="Official link"
              description="The employer's own careers page or its applicant tracking system."
            >
              <TextInput
                label="Apply link"
                value={form.url}
                onChange={set("url")}
                isRequired
                placeholder="https://boards.greenhouse.io/company/jobs/123"
                description="Not LinkedIn, Indeed, or any other job board."
                status={
                  status("url") ??
                  (blocked
                    ? {
                        type: "error",
                        message:
                          precheck.phase === "done" && precheck.result.duplicate_of
                            ? "This job is already in the pool."
                            : "This is not an official source.",
                      }
                    : undefined)
                }
              />
              <Switch
                label="Also posted on LinkedIn or Indeed"
                description="Allowed, but the job skips the hidden-job badge and earns a smaller approval credit."
                value={form.onMajorBoards}
                onChange={set("onMajorBoards")}
              />
            </SectionCard>

            <SectionCard title="The role">
              <GridSystem gap={4}>
                <GridColumn span="full" md={6}>
                  <CompanyField
                    company={form.company}
                    onCompany={set("company")}
                    status={status("company_name")}
                  />
                </GridColumn>
                <GridColumn span="full" md={6}>
                  <TextInput
                    label="Job title"
                    value={form.title}
                    onChange={set("title")}
                    isRequired
                    status={status("title")}
                  />
                </GridColumn>
                <GridColumn span="full" md={6}>
                  <TextInput
                    label="Location"
                    value={form.locationText}
                    onChange={set("locationText")}
                    placeholder="Remote (US), Berlin, …"
                    isOptional
                    status={status("location_text")}
                  />
                </GridColumn>
                <GridColumn span="full" md={4}>
                  <NumberInput
                    label="Salary from"
                    value={form.payMin}
                    onChange={set("payMin")}
                    min={0}
                    step={form.payPeriod === "hour" ? PAY_HOUR_STEP : PAY_YEAR_STEP}
                    isIntegerOnly
                    isOptional
                    units={DEFAULT_CURRENCY}
                    status={
                      payInvalid
                        ? { type: "error", message: "Must be at most the maximum." }
                        : status("pay")
                    }
                  />
                </GridColumn>
                <GridColumn span="full" md={4}>
                  <NumberInput
                    label="Salary to"
                    value={form.payMax}
                    onChange={set("payMax")}
                    min={0}
                    step={form.payPeriod === "hour" ? PAY_HOUR_STEP : PAY_YEAR_STEP}
                    isIntegerOnly
                    isOptional
                    units={DEFAULT_CURRENCY}
                    status={status("pay")}
                  />
                </GridColumn>
                <GridColumn span="full" md={4}>
                  <Selector
                    label="Pay period"
                    options={PAY_PERIOD_OPTIONS}
                    value={form.payPeriod}
                    onChange={(value) => set("payPeriod")(value as PayPeriod)}
                  />
                </GridColumn>
                <GridColumn span="full" md={4}>
                  <Selector
                    label="Work mode"
                    options={withInfer(limits.workplaces, WORKPLACE_LABEL)}
                    value={form.workplace}
                    onChange={(value) => set("workplace")(value as Workplace | "")}
                  />
                </GridColumn>
                <GridColumn span="full" md={4}>
                  <Selector
                    label="Employment"
                    options={withInfer(limits.employments, EMPLOYMENT_LABEL)}
                    value={form.employment}
                    onChange={(value) => set("employment")(value as Employment | "")}
                  />
                </GridColumn>
                <GridColumn span="full" md={4}>
                  <Selector
                    label="Seniority"
                    options={withInfer(limits.seniorities, SENIORITY_LABEL)}
                    value={form.seniority}
                    onChange={(value) => set("seniority")(value as Seniority | "")}
                  />
                </GridColumn>
              </GridSystem>
            </SectionCard>

            <SectionCard
              title="Job description"
              description="Job hunters read this on the listing. Write it in your own words."
            >
              <TextArea
                label="Job description"
                value={form.summary}
                onChange={set("summary")}
                isRequired
                description={`${summaryLength} / ${limits.max_summary_chars} characters · at least ${limits.min_summary_chars}. What the team does and who should apply.`}
                status={status("summary")}
              />
              <GridSystem gap={4}>
                <GridColumn span="full" md={6}>
                  <TextInput
                    label="Tags"
                    value={form.tags}
                    onChange={set("tags")}
                    isOptional
                    placeholder={SUGGESTED_TAGS.slice(0, 3).join(", ")}
                    description={`Comma-separated, up to ${limits.max_tags}. Use "visa" when it sponsors.`}
                    status={status("tags")}
                  />
                </GridColumn>
                <GridColumn span="full" md={6}>
                  <TextInput
                    label="Skills"
                    value={form.skills}
                    onChange={set("skills")}
                    isOptional
                    placeholder="Go, Kubernetes, SQL"
                    description={`Comma-separated, up to ${limits.max_skills}.`}
                    status={status("skills")}
                  />
                </GridColumn>
              </GridSystem>
            </SectionCard>

            <HStack gap={3} vAlign="center" wrap="wrap">
              <Button
                label="Submit job"
                variant="primary"
                clickAction={submit}
                isDisabled={!ready || blocked}
              />
              <Text type="supporting" color="secondary">
                {formatCount(quota.remaining, "submission")} left today
              </Text>
            </HStack>
          </Stack>
        </GridColumn>

        <GridColumn span="full" lg={4}>
          <Sticky offset={4}>
            <Stack gap={6}>
              <PrecheckCard state={precheck} />
              <SectionCard title="What gets approved">
                <List density="compact">
                  <ListItem
                    label="Open and official"
                    description={
                      <FullText>
                        Reachable, still taking applications, on the employer&apos;s domain or ATS.
                      </FullText>
                    }
                  />
                  <ListItem
                    label="New to the pool"
                    description={
                      <FullText>
                        The first approved submission owns a job; later ones are duplicates.
                      </FullText>
                    }
                  />
                  <ListItem
                    label={
                      level.auto_approve ? "Published automatically" : "Reviewed by a moderator"
                    }
                    description={
                      <FullText>
                        {level.auto_approve
                          ? "Clean checks publish right away; a few are spot-checked."
                          : `${level.label} scouts get every job reviewed, usually within a day.`}
                      </FullText>
                    }
                  />
                </List>
              </SectionCard>
            </Stack>
          </Sticky>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
