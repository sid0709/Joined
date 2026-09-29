"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  EmptyState,
  HStack,
  MetadataList,
  MetadataListItem,
  PageHeader,
  SectionCard,
  Skeleton,
  Stack,
  Table,
  Text,
  useToast,
  type TableColumn,
} from "@openseat/design-system";
import { ReasonActions } from "@/components/trust/reason-actions";
import { adminSend } from "@/lib/api";
import {
  CASE_ACTIONS,
  caseDecisionBody,
  caseDecisionPath,
  caseDue,
  casePath,
  casesListQuery,
  readCaseDetail,
  reasonCodeLabel,
  slaLabel,
  slaOverdue,
  type CaseEvidence,
  type CaseHistory,
  type CaseSubject,
  type DisputeDecision,
  type ReportDecision,
} from "@/lib/cases";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import { trustLoadError } from "@/lib/trust";
import { useAdminQuery } from "@/lib/use-admin-query";

/** One report or dispute: evidence, linked subjects, history, and a reasoned decision. */
export function ModerationCaseDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { result, loading, error, errorStatus, reload } = useAdminQuery<unknown>(casePath(id));
  const record = result ? readCaseDetail(result) : null;
  const [actions, setActions] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const message =
    result && !record
      ? "The API responded, but not with a case."
      : trustLoadError(errorStatus, error);
  const due = record ? caseDue(record.queue, record.createdAt, record.slaAt) : null;
  const decisions =
    record?.queue === "disputes"
      ? [
          { id: "settled" satisfies DisputeDecision, label: "Settle", variant: "primary" as const },
          {
            id: "voided" satisfies DisputeDecision,
            label: "Void",
            variant: "destructive" as const,
          },
        ]
      : [
          { id: "uphold" satisfies ReportDecision, label: "Uphold", variant: "primary" as const },
          {
            id: "dismiss" satisfies ReportDecision,
            label: "Dismiss",
            variant: "destructive" as const,
          },
        ];

  const evidence: TableColumn<CaseEvidence>[] = [
    {
      key: "label",
      header: "Evidence",
      render: (item) => <Text>{item.label || "—"}</Text>,
    },
    {
      key: "note",
      header: "Note",
      render: (item) => <Text color="secondary">{item.note || item.url || "—"}</Text>,
    },
  ];
  const subjects: TableColumn<CaseSubject>[] = [
    {
      key: "type",
      header: "Type",
      render: (item) => <Text>{item.type || "—"}</Text>,
    },
    {
      key: "id",
      header: "Id",
      render: (item) => <Text color="secondary">{item.id || "—"}</Text>,
    },
    {
      key: "label",
      header: "Label",
      render: (item) => <Text color="secondary">{item.label || "—"}</Text>,
    },
  ];
  const history: TableColumn<CaseHistory>[] = [
    {
      key: "at",
      header: "When",
      render: (event) => <Text color="secondary">{formatDateTime(event.at)}</Text>,
    },
    {
      key: "action",
      header: "Action",
      render: (event) => <Text>{event.action || "—"}</Text>,
    },
    {
      key: "actor",
      header: "Actor",
      render: (event) => <Text color="secondary">{event.actor || "—"}</Text>,
    },
    {
      key: "reason",
      header: "Reason",
      render: (event) => <Text color="secondary">{event.reason || "—"}</Text>,
    },
  ];

  async function decide(decision: string, reason: string) {
    if (!record) return;
    setPending(true);
    setDecisionError("");
    try {
      await adminSend(
        caseDecisionPath(id),
        "POST",
        caseDecisionBody(record.queue, decision, reason, actions),
      );
      toast({ body: "Decision recorded." });
      reload();
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
        title={record?.subjectLabel || "Case"}
        description="Evidence, linked subjects, history, and the decision."
        action={
          <Button
            label="Back to queue"
            variant="ghost"
            href={`${ROUTES.cases}${casesListQuery(record?.queue || "reports", "open", 1)}`}
          />
        }
      />
      {loading && !result ? <Skeleton width="100%" height={180} /> : null}
      {!loading && !record ? (
        <EmptyState isCompact title="Case unavailable" description={message || "Could not load."} />
      ) : null}
      {record ? (
        <Stack gap={5}>
          <SectionCard title="Case">
            <Stack gap={4}>
              <HStack gap={2} wrap="wrap">
                <Badge label={record.queue || "reports"} variant="neutral" />
                <Badge label={record.status || "open"} variant="warning" />
                <Badge label={reasonCodeLabel(record.reasonCode)} variant="neutral" />
                <Badge label={slaLabel(due)} variant={slaOverdue(due) ? "warning" : "neutral"} />
              </HStack>
              <MetadataList columns={2}>
                <MetadataListItem label="Subject">
                  {[record.subjectType, record.subjectId].filter(Boolean).join(" · ") || "—"}
                </MetadataListItem>
                <MetadataListItem label="Reporter">{record.reporterId || "—"}</MetadataListItem>
                <MetadataListItem label="Opened">
                  {formatDateTime(record.createdAt)}
                </MetadataListItem>
                <MetadataListItem label="Decision">{record.decision || "—"}</MetadataListItem>
              </MetadataList>
              <Text color="secondary">{record.details || "No statement on this case."}</Text>
            </Stack>
          </SectionCard>
          <SectionCard title="Evidence">
            {record.evidence.length ? (
              <Table
                caption="Case evidence"
                columns={evidence}
                rows={record.evidence}
                rowKey={(item) => item.id}
                variant="plain"
              />
            ) : (
              <Text color="secondary">No evidence attached.</Text>
            )}
          </SectionCard>
          <SectionCard title="Linked subjects">
            {record.subjects.length ? (
              <Table
                caption="Linked subjects"
                columns={subjects}
                rows={record.subjects}
                rowKey={(item) => `${item.type}|${item.id}|${item.label}`}
                variant="plain"
              />
            ) : (
              <Text color="secondary">No linked subjects.</Text>
            )}
          </SectionCard>
          <SectionCard title="History">
            {record.history.length ? (
              <Table
                caption="Case history"
                columns={history}
                rows={record.history}
                rowKey={(event) => `${event.at}|${event.actor}|${event.action}|${event.reason}`}
                variant="plain"
              />
            ) : (
              <Text color="secondary">No history on this case.</Text>
            )}
          </SectionCard>
          <SectionCard
            title="Decision"
            description="A reason is required. The admin proxy records X-Admin-Actor."
          >
            <Stack gap={3}>
              <Text type="supporting" color="secondary" display="block">
                Optional enforcement actions are sent with the decision.
              </Text>
              <HStack gap={2} wrap="wrap">
                {CASE_ACTIONS.map((action) => {
                  const selected = actions.includes(action.value);
                  return (
                    <Button
                      key={action.value}
                      label={action.label}
                      variant={selected ? "primary" : "secondary"}
                      isDisabled={pending}
                      clickAction={() =>
                        setActions((current) =>
                          current.includes(action.value)
                            ? current.filter((item) => item !== action.value)
                            : [...current, action.value],
                        )
                      }
                    />
                  );
                })}
              </HStack>
              <ReasonActions
                description={
                  record.queue === "disputes"
                    ? "Settle releases the hold. Void cancels it. Both need a reason."
                    : "Uphold the report or dismiss it. Both need a reason."
                }
                actions={decisions}
                pending={pending}
                error={decisionError}
                onSubmit={(actionId, reason) => void decide(actionId, reason)}
              />
            </Stack>
          </SectionCard>
        </Stack>
      ) : null}
    </Stack>
  );
}
