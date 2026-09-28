"use client";

import { useState } from "react";
import {
  Banner,
  Button,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  Link,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
  TextInput,
  useToast,
} from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatGrid } from "@/components/stat-card";
import { CheckOutcomeBadge, SubmissionStatusBadge } from "@/components/status-badge";
import { HOLD_DAYS } from "@/lib/config";
import { relativeDay } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { useScout } from "@/lib/scout-store";
import { ownedBy } from "@/lib/stats";
import { REWARD_TYPE_META } from "@/lib/status";

const DEMO_COMPANY_FEE_CENTS = 30_000;

export function SubmissionDetail({ id }: { id: string }) {
  const toast = useToast();
  const scout = useScout();
  const user = scout.user;
  const [rejectReason, setRejectReason] = useState("");
  if (!user) return null;
  const submission = ownedBy(scout.state.submissions, user.id).find((item) => item.id === id);
  const earnings = ownedBy(scout.state.earnings, user.id).filter(
    (item) => item.submissionId === id,
  );

  if (!submission) {
    return (
      <Stack gap={4}>
        <PageHeader title="Submission not found" />
        <Button label="Back to submissions" href={ROUTES.submissions} variant="secondary" />
      </Stack>
    );
  }

  const run = (action: () => { ok: boolean; error?: string }, okMessage: string) => {
    const result = action();
    if (!result.ok) {
      toast({ body: result.error ?? "Could not update", type: "error" });
      return;
    }
    toast({ body: okMessage });
  };

  return (
    <Stack gap={6}>
      <PageHeader
        title={submission.title}
        description={`${submission.companyName} · ${submission.locationText || "Location unknown"}`}
        action={<SubmissionStatusBadge status={submission.status} />}
      />
      {submission.rejectionReason ? (
        <Banner status="error" title={submission.rejectionReason} />
      ) : null}
      <StatGrid
        stats={[
          {
            label: "Applications",
            value: String(submission.applications),
            hint: "Job hunters and assisted bids",
          },
          { label: "Interviews", value: String(submission.interviews), hint: "Settled only" },
          { label: "Hires", value: String(submission.hires) },
          {
            label: "Rewards on this job",
            value: formatCents(earnings.reduce((sum, item) => sum + item.amountCents, 0)),
            hint: `${HOLD_DAYS}-day hold on new credits`,
          },
        ]}
      />
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={7}>
          <Stack gap={6}>
            <SectionCard title="Listing">
              <MetadataList columns={2}>
                <MetadataListItem label="Company">{submission.companyName}</MetadataListItem>
                <MetadataListItem label="Seniority">{submission.seniority}</MetadataListItem>
                <MetadataListItem label="Salary">
                  {submission.salaryText || "Unknown"}
                </MetadataListItem>
                <MetadataListItem label="Submitted">
                  {relativeDay(submission.submittedAt)}
                </MetadataListItem>
                <MetadataListItem label="Official link">
                  <Link href={submission.url}>{submission.url}</Link>
                </MetadataListItem>
                <MetadataListItem label="Badge">
                  {submission.hiddenJob ? "Hidden job" : "On major boards"}
                  {submission.expired ? " · Expired" : ""}
                </MetadataListItem>
              </MetadataList>
              <Text display="block">{submission.summary}</Text>
            </SectionCard>
            <SectionCard title="Quality checks">
              <Stack gap={3}>
                {submission.autoCheckResults.map((check) => (
                  <HStack key={check.id} hAlign="between" vAlign="start" gap={3}>
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
            </SectionCard>
            <SectionCard title="Rewards from this job">
              <Stack gap={3}>
                {earnings.length === 0 ? (
                  <Text color="secondary">No rewards yet. Interviews and hires create them.</Text>
                ) : (
                  earnings.map((item) => (
                    <HStack key={item.id} hAlign="between" gap={3} wrap="wrap">
                      <Stack gap={0.5}>
                        <Text weight="medium">{REWARD_TYPE_META[item.type].label}</Text>
                        <Text type="supporting" color="secondary">
                          {item.description}
                        </Text>
                      </Stack>
                      <Text weight="semibold" hasTabularNumbers>
                        {formatCents(item.amountCents)}
                      </Text>
                    </HStack>
                  ))
                )}
              </Stack>
            </SectionCard>
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <SectionCard
            title="Simulate outcomes"
            description="Stand-ins for interview.settled, hire.confirmed, company.claimed, and moderator review. There is no backend."
          >
            <Stack gap={3}>
              {submission.status === "needs_review" ? (
                <>
                  <Button
                    label="Demo: approve as moderator"
                    variant="primary"
                    clickAction={() =>
                      run(
                        () => scout.moderatorDecide(submission.id, "approved"),
                        "Published into the job pool.",
                      )
                    }
                  />
                  <TextInput
                    label="Reject reason"
                    value={rejectReason}
                    onChange={setRejectReason}
                  />
                  <Button
                    label="Demo: reject as moderator"
                    variant="secondary"
                    clickAction={() =>
                      run(
                        () => scout.moderatorDecide(submission.id, "rejected", rejectReason),
                        "Submission rejected.",
                      )
                    }
                  />
                </>
              ) : null}
              {submission.status === "approved" && !submission.expired ? (
                <>
                  <Button
                    label="Demo: settled interview"
                    variant="secondary"
                    icon={<Glyph name="calendar" />}
                    clickAction={() =>
                      run(() => scout.recordInterview(submission.id), "Interview reward held.")
                    }
                  />
                  <Button
                    label="Demo: confirmed hire"
                    variant="secondary"
                    clickAction={() =>
                      run(() => scout.recordHire(submission.id), "Hire reward held.")
                    }
                  />
                  <Button
                    label="Demo: company claimed page"
                    variant="secondary"
                    clickAction={() =>
                      run(
                        () => scout.recordConversion(submission.id, DEMO_COMPANY_FEE_CENTS),
                        "Conversion share added.",
                      )
                    }
                  />
                  <Button
                    label="Demo: mark expired"
                    variant="ghost"
                    clickAction={() =>
                      run(() => scout.expireJob(submission.id), "Job marked expired.")
                    }
                  />
                </>
              ) : null}
              <Text type="supporting" color="secondary" display="block">
                A scout never earns on an interview where they are also the client or bidder.
              </Text>
            </Stack>
          </SectionCard>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
