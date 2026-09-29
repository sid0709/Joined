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
import { CompanyMark } from "@/components/jobs/company-mark";
import { ReasonActions } from "@/components/trust/reason-actions";
import { adminSend } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import {
  adminCompanyPath,
  claimMethodLabel,
  readCompanyVerification,
  trustLoadError,
  verifyCompanyBody,
  verifyCompanyPath,
  type CompanyDomain,
  type CompanyMember,
  type VerificationAudit,
  type VerificationDecision,
} from "@/lib/trust";
import { useAdminQuery } from "@/lib/use-admin-query";

const DECISIONS: {
  id: VerificationDecision;
  label: string;
  variant: "primary" | "secondary" | "destructive";
}[] = [
  { id: "approve", label: "Approve", variant: "primary" },
  { id: "reject", label: "Reject", variant: "destructive" },
  { id: "suspend", label: "Suspend", variant: "secondary" },
];

/** Staff company record: domains, members, claim, and verify / reject / suspend. */
export function CompanyCaseDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { result, loading, error, errorStatus, reload } = useAdminQuery<unknown>(
    adminCompanyPath(id),
  );
  const company = result ? readCompanyVerification(result) : null;
  const [pending, setPending] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const message =
    result && !company
      ? "The API responded, but not with a company record."
      : trustLoadError(errorStatus, error);

  const members: TableColumn<CompanyMember>[] = [
    {
      key: "email",
      header: "Member",
      render: (member) => (
        <Text>{[member.name, member.email].filter(Boolean).join(" · ") || member.userId}</Text>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (member) => <Text color="secondary">{member.role || "—"}</Text>,
    },
    {
      key: "joined",
      header: "Joined",
      render: (member) => <Text color="secondary">{formatDateTime(member.createdAt)}</Text>,
    },
  ];
  const domains: TableColumn<CompanyDomain>[] = [
    {
      key: "domain",
      header: "Domain",
      render: (domain) => <Text>{domain.domain}</Text>,
    },
    {
      key: "verified",
      header: "Verified",
      render: (domain) => (
        <Badge
          label={domain.verified ? "Verified" : "Unverified"}
          variant={domain.verified ? "green" : "neutral"}
        />
      ),
    },
  ];
  const audit: TableColumn<VerificationAudit>[] = [
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
    setPending(true);
    setDecisionError("");
    try {
      await adminSend(
        verifyCompanyPath(id),
        "POST",
        verifyCompanyBody(decision as VerificationDecision, reason),
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
        title={company?.name || "Company verification"}
        description="Domains, members, claim method, and the verification decision."
        action={<Button label="Back to queue" variant="ghost" href={ROUTES.companyVerification} />}
      />
      {loading && !result ? <Skeleton width="100%" height={180} /> : null}
      {!loading && !company ? (
        <EmptyState
          isCompact
          title="Company unavailable"
          description={message || "Could not load."}
        />
      ) : null}
      {company ? (
        <Stack gap={5}>
          <SectionCard
            title="Company"
            action={
              <Button
                label="Profile editor"
                variant="ghost"
                href={`${ROUTES.companies}?company=${encodeURIComponent(company.id)}`}
              />
            }
          >
            <Stack gap={4}>
              <HStack gap={3} vAlign="center">
                <CompanyMark name={company.name} logo={company.logo} />
                <HStack gap={2} wrap="wrap">
                  <Badge label={company.verificationStatus || "unknown"} variant="warning" />
                  <Badge label={company.claimed ? "Claimed" : "Unclaimed"} variant="neutral" />
                </HStack>
              </HStack>
              <MetadataList columns={2}>
                <MetadataListItem label="Primary domain">
                  {company.primaryDomain || "—"}
                </MetadataListItem>
                <MetadataListItem label="Claim method">
                  {claimMethodLabel(company.claimMethod || company.pendingClaim?.method || "")}
                </MetadataListItem>
                <MetadataListItem label="Website">{company.url || "—"}</MetadataListItem>
                <MetadataListItem label="Requested by">
                  {company.pendingClaim?.requestedBy || "—"}
                </MetadataListItem>
                <MetadataListItem label="Verified">
                  {formatDateTime(company.verifiedAt)}
                </MetadataListItem>
                <MetadataListItem label="Suspended">
                  {formatDateTime(company.suspendedAt)}
                </MetadataListItem>
              </MetadataList>
            </Stack>
          </SectionCard>
          <SectionCard title="Domains">
            {company.domains.length ? (
              <Table
                caption="Company domains"
                columns={domains}
                rows={company.domains}
                rowKey={(domain) => domain.domain}
                variant="plain"
              />
            ) : (
              <Text color="secondary">No domains on this company.</Text>
            )}
          </SectionCard>
          <SectionCard title="Members">
            {company.members.length ? (
              <Table
                caption="Company members"
                columns={members}
                rows={company.members}
                rowKey={(member) => member.userId}
                variant="plain"
              />
            ) : (
              <Text color="secondary">No members on this company.</Text>
            )}
          </SectionCard>
          {company.audit.length ? (
            <SectionCard title="Audit">
              <Table
                caption="Verification audit"
                columns={audit}
                rows={company.audit}
                rowKey={(event) => `${event.at}|${event.actor}|${event.action}|${event.reason}`}
                variant="plain"
              />
            </SectionCard>
          ) : null}
          <SectionCard
            title="Decision"
            description="A reason is required. The admin proxy records X-Admin-Actor."
          >
            <ReasonActions
              description="Approve verifies the company. Reject declines the claim. Suspend locks it."
              actions={DECISIONS}
              pending={pending}
              error={decisionError}
              onSubmit={(actionId, reason) => void decide(actionId, reason)}
            />
          </SectionCard>
        </Stack>
      ) : null}
    </Stack>
  );
}
