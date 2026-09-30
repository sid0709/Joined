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
  CASE_STATUS_RESOLVED,
  caseDecisionBody,
  caseDecisionPath,
  caseDue,
  caseFromSearch,
  casesListQuery,
  isCompanyAtsReason,
  readCasePayload,
  reasonCodeLabel,
  slaLabel,
  slaOverdue,
  type ModerationCase,
} from "@/lib/cases";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/nav";

/** One case from the list row. There is no locked get-by-id; the decision is posted. */
export function ModerationCaseDetail({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [record, setRecord] = useState<ModerationCase>(() => caseFromSearch(id, searchParams));
  const [pending, setPending] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const due = caseDue(record.queue, record.createdAt, record.slaAt);
  const resolved = record.status === CASE_STATUS_RESOLVED || Boolean(record.decision);

  async function decide(decision: string, reason: string) {
    setPending(true);
    setDecisionError("");
    try {
      const response = await adminSend<unknown>(
        caseDecisionPath(id),
        "POST",
        caseDecisionBody(decision, reason),
      );
      const updated = readCasePayload(response);
      if (updated) setRecord(updated);
      else {
        setRecord((current) => ({
          ...current,
          status: CASE_STATUS_RESOLVED,
          decision,
          decisionReason: reason.trim(),
        }));
      }
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
            <MetadataListItem label="SLA">{formatDateTime(record.slaAt)}</MetadataListItem>
            <MetadataListItem label="Decision">{record.decision || "—"}</MetadataListItem>
            <MetadataListItem label="Decided by">{record.decidedBy || "—"}</MetadataListItem>
            <MetadataListItem label="Decision reason">
              {record.decisionReason || "—"}
            </MetadataListItem>
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
      {record.decisionEvidenceKeys.length ? (
        <SectionCard title="Decision evidence">
          <Stack gap={2}>
            {record.decisionEvidenceKeys.map((key) => (
              <Text key={key}>{key}</Text>
            ))}
          </Stack>
        </SectionCard>
      ) : null}
      {resolved ? (
        <SectionCard
          title="Decision"
          description="This case is resolved. A second decision is rejected."
        >
          <Text color="secondary">
            {[record.decision, record.decisionReason].filter(Boolean).join(" — ") || "Resolved."}
          </Text>
        </SectionCard>
      ) : (
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
      )}
    </Stack>
  );
}
