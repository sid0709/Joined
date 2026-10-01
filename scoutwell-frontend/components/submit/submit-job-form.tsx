"use client";

import {
  Banner,
  Button,
  CheckboxInput,
  GridColumn,
  GridSystem,
  HStack,
  List,
  ListItem,
  LocationSelector,
  NumberInput,
  Selector,
  Stack,
  Sticky,
  Text,
  TextArea,
  TextInput,
  useToast,
  PageHeader,
  SectionCard,
} from "@joined/design-system";
import {
  ApiError,
  DEFAULT_CURRENCY,
  EMPLOYMENT_LABEL,
  PAY_PERIOD_OPTIONS,
  WORKPLACE_LABEL,
  seniorityLabel,
  options,
  type Employment,
  type LevelRule,
  type Limits,
  type PayPeriod,
  type Quota,
  type Seniority,
  type Submission,
  type Workplace,
} from "@joined/scout";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CompanyField, type CompanyChoice } from "./company-field";
import { MatchesCard } from "./matches-card";
import { PrecheckCard } from "./precheck-card";
import { useMatches } from "./use-matches";
import { usePrecheck } from "./use-precheck";

import { FullText } from "@/components/full-text";
import { formatCount } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { scoutSend } from "@/lib/scout/client";

/** Blank seniority means the API infers it from the title. */
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
  equity: boolean;
  summary: string;
};

const EMPTY: Form = {
  url: "",
  company: null,
  title: "",
  locationText: "",
  workplace: "",
  employment: "",
  seniority: INFER,
  payMin: 0,
  payMax: 0,
  payPeriod: "year",
  equity: false,
  summary: "",
};

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
  const [notDuplicateClaim, setNotDuplicateClaim] = useState(false);
  const precheck = usePrecheck(form.url);
  const matches = useMatches(
    form.url,
    form.company?.id ?? "",
    form.company?.name ?? "",
    form.title,
  );
  const matchList = matches.phase === "done" ? matches.matches : [];

  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
      setIdempotencyKey(crypto.randomUUID());
      if (key === "url" || key === "company" || key === "title") {
        setNotDuplicateClaim(false);
      }
    };
  const status = (field: string) => {
    const message = error?.field(field);
    return message ? { type: "error" as const, message } : undefined;
  };

  const summaryLength = form.summary.trim().length;
  const payInvalid = !form.equity && form.payMax > 0 && form.payMin > form.payMax;
  const payReady = form.equity || (form.payMin > 0 && form.payMax > 0 && !payInvalid);
  const blocked = precheck.phase === "done" && !precheck.result.official;
  const needsClaim = matchList.length > 0;
  const ready =
    Boolean(
      form.url.trim() &&
      form.company &&
      form.title.trim() &&
      form.locationText.trim() &&
      form.workplace &&
      form.employment,
    ) &&
    payReady &&
    summaryLength >= limits.min_summary_chars &&
    summaryLength <= limits.max_summary_chars &&
    quota.remaining > 0 &&
    (!needsClaim || notDuplicateClaim);

  const setEquity = (equity: boolean) => {
    setForm((current) => ({
      ...current,
      equity,
      payMin: equity ? 0 : current.payMin,
      payMax: equity ? 0 : current.payMax,
    }));
    setIdempotencyKey(crypto.randomUUID());
  };

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
            min: form.equity ? 0 : form.payMin,
            max: form.equity ? 0 : form.payMax,
            currency: DEFAULT_CURRENCY,
            period: form.payPeriod,
          },
          equity: form.equity,
          salary: "",
          summary: form.summary,
          not_duplicate_claim: needsClaim ? notDuplicateClaim : false,
        },
        { "Idempotency-Key": idempotencyKey },
      );
      toast({ body: "Submitted. It waits in Scout jobs until staff analyze it." });
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
        description="An official opening that is not already in the pool. Staff analyze it before it appears in search."
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
                    ? { type: "error", message: "This is not an official source." }
                    : undefined)
                }
              />
            </SectionCard>

            <SectionCard title="The role">
              <GridSystem gap={4}>
                <GridColumn span="full" md={4}>
                  <CompanyField
                    company={form.company}
                    onCompany={set("company")}
                    status={status("company_name")}
                  />
                </GridColumn>
                <GridColumn span="full" md={4}>
                  <TextInput
                    label="Job title"
                    value={form.title}
                    onChange={set("title")}
                    isRequired
                    status={status("title")}
                  />
                </GridColumn>
                <GridColumn span="full" md={4}>
                  <LocationSelector
                    label="Location"
                    value={form.locationText}
                    onChange={set("locationText")}
                    placeholder="City, state, or country"
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
                    isRequired={!form.equity}
                    isDisabled={form.equity}
                    disabledMessage="Turn off equity to enter a salary."
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
                    isRequired={!form.equity}
                    isDisabled={form.equity}
                    disabledMessage="Turn off equity to enter a salary."
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
                    isDisabled={form.equity}
                    disabledMessage="Turn off equity to enter a salary."
                  />
                </GridColumn>
                <GridColumn span="full">
                  <CheckboxInput
                    label="Equity"
                    description="This role is paid in equity, so salary from and salary to stay blank."
                    value={form.equity}
                    onChange={setEquity}
                  />
                </GridColumn>
                <GridColumn span="full" md={4}>
                  <Selector
                    label="Work mode"
                    options={options(limits.workplaces, WORKPLACE_LABEL)}
                    value={form.workplace}
                    onChange={(value) => set("workplace")(value as Workplace | "")}
                    isRequired
                    placeholder="Select work mode"
                    status={status("workplace")}
                  />
                </GridColumn>
                <GridColumn span="full" md={4}>
                  <Selector
                    label="Employment"
                    options={options(limits.employments, EMPLOYMENT_LABEL)}
                    value={form.employment}
                    onChange={(value) => set("employment")(value as Employment | "")}
                    isRequired
                    placeholder="Select employment"
                    status={status("employment")}
                  />
                </GridColumn>
                <GridColumn span="full" md={4}>
                  <Selector
                    label="Seniority"
                    options={[
                      { value: INFER, label: "Detect automatically" },
                      ...limits.seniorities.map((value) => ({
                        value,
                        label: seniorityLabel(value),
                      })),
                    ]}
                    value={form.seniority}
                    onChange={(value) => set("seniority")(value as Seniority | "")}
                  />
                </GridColumn>
              </GridSystem>
            </SectionCard>

            <SectionCard
              title="Job description"
              description="The posting text staff analyze into the public listing."
            >
              <TextArea
                label="Job description"
                value={form.summary}
                onChange={set("summary")}
                isRequired
                description={`${summaryLength} / ${limits.max_summary_chars} characters · at least ${limits.min_summary_chars}. What the team does and who should apply.`}
                status={
                  status("summary") ??
                  (summaryLength > limits.max_summary_chars
                    ? {
                        type: "error",
                        message: `Shorten this to ${limits.max_summary_chars} characters.`,
                      }
                    : undefined)
                }
              />
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
              <MatchesCard
                state={matches}
                claimed={notDuplicateClaim}
                onClaim={(value) => {
                  setNotDuplicateClaim(value);
                  setIdempotencyKey(crypto.randomUUID());
                }}
              />
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
                    label="Possible matches reviewed"
                    description={
                      <FullText>
                        Existing jobs with this link or company and title are shown. You can claim
                        yours is distinct; staff decide.
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
