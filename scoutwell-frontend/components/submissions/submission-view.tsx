import {
  Badge,
  Banner,
  Button,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  Link,
  MetadataList,
  MetadataListItem,
  Spinner,
  Stack,
  Step,
  Stepper,
  Text,
  Timeline,
  type BannerStatus,
  type TimelineItem,
  PageHeader,
  SectionCard,
  StatGrid,
} from "@openseat/design-system";
import {
  EMPLOYMENT_LABEL,
  REWARD_TYPE,
  seniorityLabel,
  SUBMISSION_STATUS,
  WORKPLACE_LABEL,
  formatMoney,
  isPending,
  sumMoney,
  type Earning,
  type Submission,
} from "@openseat/scout";

import { RefreshWhilePending } from "./refresh-while-pending";

import {
  CheckOutcomeBadge,
  EarningStatusBadge,
  SubmissionStatusBadge,
} from "@/components/status-badge";
import { formatDateTime, formatDay } from "@/lib/dates";
import { sourceLabel } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

type StepState = { active: number; status?: "success" | "warning" | "error" };

/** Where the submission sits in submitted → checks → review → published. */
function pipeline(sub: Submission): StepState {
  switch (sub.status) {
    case "submitted":
    case "auto_checking":
      return { active: 1 };
    case "needs_review":
      return { active: 2, status: "warning" };
    case "approved":
      return { active: 3, status: "success" };
    default:
      return { active: sub.reviewed_by && sub.reviewed_by !== "auto" ? 2 : 1, status: "error" };
  }
}

function banner(
  sub: Submission,
): { status: BannerStatus; title: string; description: string } | null {
  if (isPending(sub.status)) return null;
  if (sub.status === "approved" && sub.expired) {
    return {
      status: "info",
      title: "This job has closed",
      description: "It left the pool. Rewards you already earned stay yours.",
    };
  }
  switch (sub.status) {
    case "approved":
      return {
        status: "success",
        title: "Live in the job pool",
        description: sub.hidden_job
          ? "Job hunters see it with the hidden-job badge."
          : "Job hunters can find and apply to it now.",
      };
    case "needs_review":
      return {
        status: "warning",
        title: "Waiting on a moderator",
        description: sub.spot_check
          ? "Picked for a random spot check. Nothing is wrong."
          : "The checks below flagged something a person should look at, or your level needs review.",
      };
    case "rejected":
      return {
        status: "error",
        title: "Rejected",
        description: sub.rejection_reason
          ? capitalize(sub.rejection_reason) + "."
          : "It did not meet the quality bar.",
      };
    case "duplicate":
      return {
        status: "info",
        title: "Already in the pool",
        description:
          "The first approved submission owns a job. Look for openings nobody has sent yet.",
      };
    default:
      return null;
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function history(sub: Submission): TimelineItem[] {
  const items: TimelineItem[] = [
    {
      id: "submitted",
      title: sub.channel === "api" ? "Submitted over the API" : "Submitted",
      time: formatDateTime(sub.submitted_at),
      tone: "accent",
      status: "done",
    },
  ];
  if (sub.checked_at) {
    items.push({
      id: "checked",
      title: "Automatic checks finished",
      time: formatDateTime(sub.checked_at),
      tone: "accent",
      status: "done",
    });
  }
  if (sub.reviewed_at && sub.status !== "needs_review") {
    items.push({
      id: "reviewed",
      title:
        sub.reviewed_by === "auto"
          ? "Auto-approved"
          : `${SUBMISSION_STATUS[sub.status].label} by a moderator`,
      description: sub.review_note || undefined,
      time: formatDateTime(sub.reviewed_at),
      tone: sub.status === "approved" ? "success" : "danger",
      status: "done",
    });
  }
  if (sub.expired && sub.expired_at) {
    items.push({
      id: "expired",
      title: "Closed and removed from search",
      time: formatDateTime(sub.expired_at),
      tone: "neutral",
      status: "done",
    });
  }
  return items;
}

export function SubmissionView({
  submission: sub,
  earnings,
  jobHref,
}: {
  submission: Submission;
  earnings: Earning[];
  jobHref: string;
}) {
  const pending = isPending(sub.status);
  const step = pipeline(sub);
  const notice = banner(sub);
  const earned = sumMoney(
    earnings.filter((item) => item.status !== "clawed_back").map((item) => item.amount),
  );
  const live = sub.status === "approved";

  return (
    <Stack gap={6}>
      <RefreshWhilePending id={sub.id} pending={pending} />
      <HStack>
        <Button
          label="Submissions"
          variant="ghost"
          size="sm"
          icon={<Glyph name="chevronLeft" />}
          href={ROUTES.submissions}
        />
      </HStack>
      <PageHeader
        title={sub.title}
        description={[sub.company_name, sub.location_text].filter(Boolean).join(" · ")}
        action={
          <HStack gap={2} vAlign="center" wrap="wrap">
            <SubmissionStatusBadge submission={sub} />
            {live && sub.hidden_job && !sub.expired ? (
              <Badge label="Hidden job" variant="purple" />
            ) : null}
            {jobHref ? (
              <Button
                label="View live job"
                variant="secondary"
                size="sm"
                href={jobHref}
                target="_blank"
              />
            ) : null}
          </HStack>
        }
      />

      {pending ? (
        <Banner
          status="info"
          title="Running the automatic checks"
          description="Opening the link, confirming it is official and open, and looking for duplicates. This page updates by itself."
          icon={<Spinner size="sm" />}
        />
      ) : null}
      {notice ? (
        <Banner status={notice.status} title={notice.title} description={notice.description} />
      ) : null}

      <SectionCard title="Pipeline">
        <Stepper activeStep={step.active} orientation="horizontal">
          <Step step={0} label="Submitted" description={formatDay(sub.submitted_at)} />
          <Step
            step={1}
            label="Automatic checks"
            status={step.active === 1 ? step.status : undefined}
          />
          <Step step={2} label="Review" status={step.active === 2 ? step.status : undefined} />
          <Step step={3} label="Published" status={step.active === 3 ? step.status : undefined} />
        </Stepper>
      </SectionCard>

      <StatGrid
        stats={[
          {
            label: "Applications",
            value: live ? String(sub.activity.applications) : "—",
            hint: "From Opened job hunters",
          },
          {
            label: "Interviews",
            value: live ? String(sub.activity.interviews) : "—",
            hint: "Scheduled by candidates",
          },
          {
            label: "Settled",
            value: String(sub.settled_interviews),
            hint: `${sub.hires} confirmed ${sub.hires === 1 ? "hire" : "hires"}`,
          },
          {
            label: "Earned here",
            value: formatMoney(earned),
            hint: "Approval, interview, and hire rewards",
          },
        ]}
      />

      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={7}>
          <Stack gap={6}>
            <SectionCard
              title="Quality checks"
              description="What the pipeline found when it opened your link."
            >
              {sub.auto_check_results.length === 0 ? (
                <Text color="secondary" display="block">
                  {pending ? "Checks are running…" : "No checks recorded."}
                </Text>
              ) : (
                <Stack gap={4}>
                  {sub.auto_check_results.map((check) => (
                    <HStack key={check.id} hAlign="between" vAlign="start" gap={4}>
                      <Stack gap={0.5}>
                        <Text weight="medium">{check.label}</Text>
                        <Text type="supporting" color="secondary" display="block">
                          {check.detail}
                        </Text>
                      </Stack>
                      <CheckOutcomeBadge outcome={check.outcome} />
                    </HStack>
                  ))}
                </Stack>
              )}
            </SectionCard>
            <SectionCard title="Listing">
              <MetadataList columns={2}>
                <MetadataListItem label="Company">{sub.company_name}</MetadataListItem>
                <MetadataListItem label="Source">{sourceLabel(sub.host, sub.ats)}</MetadataListItem>
                <MetadataListItem label="Work mode">
                  {WORKPLACE_LABEL[sub.workplace]}
                </MetadataListItem>
                <MetadataListItem label="Employment">
                  {EMPLOYMENT_LABEL[sub.employment]}
                </MetadataListItem>
                <MetadataListItem label="Seniority">
                  {seniorityLabel(sub.seniority)}
                </MetadataListItem>
                <MetadataListItem label="Salary">{sub.salary || "Not listed"}</MetadataListItem>
                {sub.external_ref ? (
                  <MetadataListItem label="Your reference">{sub.external_ref}</MetadataListItem>
                ) : null}
              </MetadataList>
              <Link href={sub.url} target="_blank">
                {sub.url}
              </Link>
              <Text display="block">{sub.summary}</Text>
              {sub.tags.length + sub.skills.length > 0 ? (
                <HStack gap={1.5} wrap="wrap">
                  {sub.tags.map((tag) => (
                    <Badge key={`tag-${tag}`} label={tag} variant="blue" />
                  ))}
                  {sub.skills.map((skill) => (
                    <Badge key={`skill-${skill}`} label={skill} variant="neutral" />
                  ))}
                </HStack>
              ) : null}
            </SectionCard>
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <Stack gap={6}>
            <SectionCard title="Rewards from this job">
              {earnings.length === 0 ? (
                <Text color="secondary" display="block">
                  {live
                    ? "Settled interviews and confirmed hires on this job pay you here."
                    : "Rewards start once the job is published."}
                </Text>
              ) : (
                <Stack gap={4}>
                  {earnings.map((item) => (
                    <HStack key={item.id} hAlign="between" vAlign="start" gap={3}>
                      <Stack gap={0.5}>
                        <Text weight="medium">{REWARD_TYPE[item.type].label}</Text>
                        <Text type="supporting" color="secondary">
                          {item.status === "held"
                            ? `Held until ${formatDay(item.hold_until)}`
                            : formatDay(item.created_at)}
                        </Text>
                      </Stack>
                      <Stack gap={1} hAlign="end">
                        <Text weight="semibold" hasTabularNumbers>
                          {formatMoney(item.amount)}
                        </Text>
                        <EarningStatusBadge status={item.status} />
                      </Stack>
                    </HStack>
                  ))}
                </Stack>
              )}
            </SectionCard>
            <SectionCard title="History">
              <Timeline label="Submission history" items={history(sub)} />
            </SectionCard>
          </Stack>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
