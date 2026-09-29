"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  CodeBlock,
  Collapsible,
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
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import {
  caseDecisionBody,
  caseDecisionPath,
  casePath,
  claimMethodLabel,
  readCaseDetail,
  trustLoadError,
  type CaseDecision,
  type TrustMember,
} from "@/lib/trust";
import { useAdminQuery } from "@/lib/use-admin-query";

const RAW_MAX_HEIGHT = 320;

const DECISIONS: {
  id: CaseDecision;
  label: string;
  variant: "primary" | "secondary" | "destructive";
}[] = [
  { id: "approve", label: "Approve", variant: "primary" },
  { id: "reject", label: "Reject", variant: "destructive" },
  { id: "suspend", label: "Suspend", variant: "secondary" },
];

/** One verification or claim case: domain, members, method, and the linked company. */
export function CompanyCaseDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { result, loading, error, errorStatus, reload } = useAdminQuery<unknown>(casePath(id));
  const item = result ? readCaseDetail(result) : null;
  const [pending, setPending] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const message =
    result && !item
      ? "The API responded, but not with a case."
      : trustLoadError(errorStatus, error);

  const members: TableColumn<TrustMember>[] = [
    {
      key: "email",
      header: "Member",
      render: (member) => <Text>{member.email || member.id}</Text>,
    },
    {
      key: "role",
      header: "Role",
      render: (member) => <Text color="secondary">{member.role || "—"}</Text>,
    },
    {
      key: "status",
      header: "Status",
      render: (member) => <Text color="secondary">{member.status || "—"}</Text>,
    },
  ];

  async function decide(decision: string, reason: string) {
    setPending(true);
    setDecisionError("");
    try {
      await adminSend(
        caseDecisionPath(id),
        "POST",
        caseDecisionBody(decision as CaseDecision, reason),
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
        title={item?.title ?? "Verification case"}
        description="Domain, members, claim method, and the company this case is linked to."
        action={<Button label="Back to queue" variant="ghost" href={ROUTES.companyVerification} />}
      />
      {loading && !result ? <Skeleton width="100%" height={180} /> : null}
      {!loading && !item ? (
        <Stack gap={4}>
          {message ? <EmptyState isCompact title="Case unavailable" description={message} /> : null}
        </Stack>
      ) : null}
      {item ? (
        <Stack gap={5}>
          <SectionCard title="Evidence">
            <Stack gap={4}>
              <HStack gap={2}>
                <Badge label={item.status} variant="warning" />
                {item.createdAt ? (
                  <Badge label={formatDateTime(item.createdAt)} variant="neutral" />
                ) : null}
              </HStack>
              <MetadataList columns={2}>
                <MetadataListItem label="Domain">{item.domain || "—"}</MetadataListItem>
                <MetadataListItem label="Claim method">
                  {claimMethodLabel(item.claimMethod)}
                </MetadataListItem>
                <MetadataListItem label="Linked company">
                  {item.company?.id ? (
                    <Button
                      label={item.company.name || item.company.id}
                      variant="ghost"
                      href={`${ROUTES.companies}?company=${encodeURIComponent(item.company.id)}`}
                    />
                  ) : (
                    item.company?.name || "—"
                  )}
                </MetadataListItem>
                <MetadataListItem label="Company status">
                  {item.company?.status || "—"}
                </MetadataListItem>
              </MetadataList>
            </Stack>
          </SectionCard>
          <SectionCard title="Members">
            {item.members.length ? (
              <Table
                caption="Case members"
                columns={members}
                rows={item.members}
                rowKey={(member) => member.id || member.email}
                variant="plain"
              />
            ) : (
              <Text color="secondary">No members on this case.</Text>
            )}
          </SectionCard>
          <SectionCard
            title="Decision"
            description="A reason is required. The admin proxy records X-Admin-Actor."
          >
            <ReasonActions
              description="Approve verifies the claim. Reject declines it. Suspend locks the company."
              actions={DECISIONS}
              pending={pending}
              error={decisionError}
              onSubmit={(actionId, reason) => void decide(actionId, reason)}
            />
          </SectionCard>
          <Collapsible trigger="Raw case">
            <CodeBlock
              code={JSON.stringify(result, null, 2)}
              language="json"
              maxHeight={RAW_MAX_HEIGHT}
            />
          </Collapsible>
        </Stack>
      ) : null}
    </Stack>
  );
}
