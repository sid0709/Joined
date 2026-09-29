"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  HStack,
  MetadataList,
  MetadataListItem,
  PageHeader,
  SectionCard,
  Stack,
  Text,
  useToast,
} from "@openseat/design-system";
import { ReasonActions } from "@/components/trust/reason-actions";
import { adminSend } from "@/lib/api";
import {
  CASE_DECISIONS,
  caseDecisionBody,
  caseDecisionPath,
  caseDue,
  caseFromSearch,
  casesListQuery,
  isCompanyAtsReason,
  reasonCodeLabel,
  slaLabel,
  slaOverdue,
} from "@/lib/cases";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/nav";

/** One case from the list row. There is no locked get-by-id; the decision is posted. */
export function ModerationCaseDetail({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const record = caseFromSearch(id, searchParams);
  const [pending, setPending] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const due = caseDue(record.queue, record.createdAt, record.slaAt);

  async function decide(decision: string, reason: string) {
    setPending(true);
    setDecisionError("");
    try {
      await adminSend(caseDecisionPath(id), "POST", caseDecisionBody(decision, reason));
      toast({ body: "Decision recorded." });
      router.refresh();
    } catch (cause) {
      setDecisionError(cause instanceof Error ? cause.message : "Could not save the decision.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack gap={5}>
      <PageHeader
        title={record.subjectId || "Case"}
        description="Subject, evidence keys, and the decision. Uphold or dismiss requires a reason."
        action={
          <Button
            label="Back to queue"
            variant="ghost"
            href={`${ROUTES.cases}${casesListQuery(record.queue || "reports", record.status || "open", 1)}`}
          />
        }
      />
      <SectionCard title="Case">
        <Stack gap={4}>
          <HStack gap={2} wrap="wrap">
            <Badge label={record.queue || "reports"} variant="neutral" />
            <Badge label={record.status || "open"} variant="warning" />
            <Badge
              label={reasonCodeLabel(record.reasonCode)}
              variant={isCompanyAtsReason(record.reasonCode) ? "warning" : "neutral"}
            />
            <Badge label={slaLabel(due)} variant={slaOverdue(due) ? "warning" : "neutral"} />
          </HStack>
          <MetadataList columns={2}>
            <MetadataListItem label="Subject type">{record.subjectType || "—"}</MetadataListItem>
            <MetadataListItem label="Subject id">{record.subjectId || "—"}</MetadataListItem>
            <MetadataListItem label="Opened">{formatDateTime(record.createdAt)}</MetadataListItem>
            <MetadataListItem label="Decision">{record.decision || "—"}</MetadataListItem>
          </MetadataList>
          <Text color="secondary">{record.details || "No statement on this case."}</Text>
        </Stack>
      </SectionCard>
      <SectionCard title="Evidence">
        {record.evidenceKeys.length ? (
          <Stack gap={2}>
            {record.evidenceKeys.map((key) => (
              <Text key={key}>{key}</Text>
            ))}
          </Stack>
        ) : (
          <Text color="secondary">No evidence keys on this case.</Text>
        )}
      </SectionCard>
      <SectionCard
        title="Decision"
        description="A reason is required. The admin proxy records X-Admin-Actor."
      >
        <ReasonActions
          description="Uphold or dismiss. The body omits actions until action codes are locked."
          actions={CASE_DECISIONS.map((item) => ({
            id: item.value,
            label: item.label,
            variant: item.value === "uphold" ? ("primary" as const) : ("destructive" as const),
          }))}
          pending={pending}
          error={decisionError}
          onSubmit={(actionId, reason) => void decide(actionId, reason)}
        />
      </SectionCard>
    </Stack>
  );
}
