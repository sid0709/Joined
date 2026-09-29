"use client";

import {
  Badge,
  Button,
  CheckboxInput,
  GridColumn,
  GridSystem,
  HStack,
  Link,
  MetadataList,
  MetadataListItem,
  NumberInput,
  SectionCard,
  Selector,
  Stack,
  Text,
  TextArea,
  TextInput,
} from "@openseat/design-system";
import { DEFAULT_CURRENCY, PAY_PERIOD_OPTIONS } from "@openseat/job-schema";
import {
  EMPLOYMENT_LABEL,
  SENIORITY_LABEL,
  WORKPLACE_LABEL,
  seniorityLabel,
  type Employment,
  type Pay,
  type PayPeriod,
  type Seniority,
  type Submission,
  type SubmissionInput,
  type Workplace,
} from "@openseat/scout";

import { ROUTES } from "@/lib/nav";

function choices<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

const WORKPLACES = choices(WORKPLACE_LABEL);
const EMPLOYMENTS = choices(EMPLOYMENT_LABEL);
const SENIORITIES = choices(SENIORITY_LABEL);

function withPay(pay: Pay | undefined, patch: Partial<Pay>): Pay {
  return {
    min: pay?.min ?? 0,
    max: pay?.max ?? 0,
    currency: pay?.currency || DEFAULT_CURRENCY,
    period: pay?.period ?? "year",
    ...patch,
  };
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * What job hunters will see once this is published. Editable while the
 * submission waits on a decision; approving saves the edits first.
 */
export function JobEditor({
  submission,
  value,
  onChange,
  isEditable,
  isDirty,
  onReset,
  onAnalyze,
  analyzing,
}: {
  submission: Submission;
  value: SubmissionInput;
  onChange: (value: SubmissionInput) => void;
  isEditable: boolean;
  isDirty: boolean;
  onReset: () => void;
  onAnalyze?: () => void;
  analyzing?: boolean;
}) {
  const set =
    <K extends keyof SubmissionInput>(key: K) =>
    (next: SubmissionInput[K]) =>
      onChange({ ...value, [key]: next });

  if (!isEditable) {
    return (
      <SectionCard
        title="Job details"
        description={
          submission.job_id
            ? "On Jobs after analyze. Edit the live listing there."
            : "Details as submitted."
        }
        action={
          <HStack gap={2}>
            {onAnalyze ? (
              <Button
                label={analyzing ? "Analyzing…" : "Analyze with AI"}
                variant="secondary"
                size="sm"
                clickAction={onAnalyze}
                isDisabled={analyzing}
              />
            ) : null}
            {submission.job_id ? (
              <Button
                label="Edit on Jobs"
                variant="ghost"
                size="sm"
                href={`${ROUTES.jobs}?job=${submission.job_id}`}
              />
            ) : null}
          </HStack>
        }
      >
        <MetadataList columns={2}>
          <MetadataListItem label="Location">{submission.location_text || "—"}</MetadataListItem>
          <MetadataListItem label="Work mode">
            {WORKPLACE_LABEL[submission.workplace]}
          </MetadataListItem>
          <MetadataListItem label="Employment">
            {EMPLOYMENT_LABEL[submission.employment]}
          </MetadataListItem>
          <MetadataListItem label="Seniority">
            {seniorityLabel(submission.seniority)}
          </MetadataListItem>
          <MetadataListItem label="Salary">
            {submission.equity ? "Equity" : submission.salary || "Not listed"}
          </MetadataListItem>
        </MetadataList>
        <Link href={submission.url} target="_blank">
          {submission.url}
        </Link>
        <Text display="block">{submission.summary}</Text>
        <HStack gap={1.5} wrap="wrap">
          {submission.tags.map((tag) => (
            <Badge key={`t-${tag}`} label={tag} variant="blue" />
          ))}
          {submission.skills.map((skill) => (
            <Badge key={`s-${skill}`} label={skill} variant="neutral" />
          ))}
        </HStack>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Job details"
      description="Fix anything the scout got wrong. Analyze writes About / What you’ll do for Opened. Salary and other filled fields stay."
      action={
        <HStack gap={2}>
          {isDirty ? (
            <Button label="Undo edits" variant="ghost" size="sm" clickAction={onReset} />
          ) : null}
          {onAnalyze ? (
            <Button
              label={analyzing ? "Analyzing…" : "Analyze with AI"}
              variant="secondary"
              size="sm"
              clickAction={onAnalyze}
              isDisabled={analyzing}
            />
          ) : null}
        </HStack>
      }
    >
      <Stack gap={4}>
        <Link href={submission.url} target="_blank">
          {submission.url}
        </Link>
        <GridSystem gap={4}>
          <GridColumn span="full" md={6}>
            <TextInput label="Title" value={value.title} onChange={set("title")} />
          </GridColumn>
          <GridColumn span="full" md={6}>
            <TextInput
              label="Location"
              value={value.location_text}
              onChange={set("location_text")}
            />
          </GridColumn>
          <GridColumn span="full" md={4}>
            <NumberInput
              label="Salary from"
              value={value.pay?.min ?? 0}
              onChange={(next) => set("pay")(withPay(value.pay, { min: next }))}
              min={0}
              isIntegerOnly
              isRequired={!value.equity}
              isDisabled={value.equity}
              disabledMessage="Turn off equity to enter a salary."
              units={DEFAULT_CURRENCY}
            />
          </GridColumn>
          <GridColumn span="full" md={4}>
            <NumberInput
              label="Salary to"
              value={value.pay?.max ?? 0}
              onChange={(next) => set("pay")(withPay(value.pay, { max: next }))}
              min={0}
              isIntegerOnly
              isRequired={!value.equity}
              isDisabled={value.equity}
              disabledMessage="Turn off equity to enter a salary."
              units={DEFAULT_CURRENCY}
            />
          </GridColumn>
          <GridColumn span="full" md={4}>
            <Selector
              label="Pay period"
              options={PAY_PERIOD_OPTIONS}
              value={value.pay?.period ?? "year"}
              onChange={(next) => set("pay")(withPay(value.pay, { period: next as PayPeriod }))}
              isDisabled={value.equity}
              disabledMessage="Turn off equity to enter a salary."
            />
          </GridColumn>
          <GridColumn span="full">
            <CheckboxInput
              label="Equity"
              description="Paid in equity. Salary from and salary to are cleared."
              value={value.equity}
              onChange={(checked) =>
                onChange({
                  ...value,
                  equity: checked,
                  pay: checked ? withPay(value.pay, { min: 0, max: 0 }) : value.pay,
                  salary: checked ? "" : value.salary,
                })
              }
            />
          </GridColumn>
          <GridColumn span="full" md={4}>
            <Selector
              label="Work mode"
              options={WORKPLACES}
              value={value.workplace ?? ""}
              onChange={(next) => set("workplace")(next as Workplace)}
            />
          </GridColumn>
          <GridColumn span="full" md={4}>
            <Selector
              label="Employment"
              options={EMPLOYMENTS}
              value={value.employment ?? ""}
              onChange={(next) => set("employment")(next as Employment)}
            />
          </GridColumn>
          <GridColumn span="full" md={4}>
            <Selector
              label="Seniority"
              options={SENIORITIES}
              value={value.seniority ?? ""}
              onChange={(next) => set("seniority")(next as Seniority)}
            />
          </GridColumn>
        </GridSystem>
        <TextArea
          label="Job description"
          value={value.summary}
          onChange={set("summary")}
          description={`${value.summary.trim().length} characters. Shown to job hunters.`}
        />
        <GridSystem gap={4}>
          <GridColumn span="full" md={6}>
            <TextInput
              label="Tags"
              value={value.tags.join(", ")}
              onChange={(next) => set("tags")(splitList(next.toLowerCase()))}
              description="Comma-separated; visa marks sponsorship."
            />
          </GridColumn>
          <GridColumn span="full" md={6}>
            <TextInput
              label="Skills"
              value={value.skills.join(", ")}
              onChange={(next) => set("skills")(splitList(next))}
              description="Comma-separated."
            />
          </GridColumn>
        </GridSystem>
      </Stack>
    </SectionCard>
  );
}
