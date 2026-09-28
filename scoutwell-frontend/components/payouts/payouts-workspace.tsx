"use client";

import { useState } from "react";
import {
  Banner,
  Button,
  FileInput,
  Stack,
  Table,
  Text,
  TextInput,
  useToast,
  type TableColumn,
} from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatGrid } from "@/components/stat-card";
import { MIN_PAYOUT_CENTS } from "@/lib/config";
import { relativeDay } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { availablePayoutCents, canRequestPayout, earningsTotals } from "@/lib/rewards";
import { useScout } from "@/lib/scout-store";
import { ownedBy } from "@/lib/stats";
import type { Payout } from "@/lib/types";

export function PayoutsWorkspace() {
  const toast = useToast();
  const scout = useScout();
  const user = scout.user;
  const [last4, setLast4] = useState(user?.payoutMethod?.last4 ?? "4242");
  const [idFile, setIdFile] = useState<File | null>(null);
  if (!user) return null;
  const mine = ownedBy(scout.state.earnings, user.id);
  const totals = earningsTotals(mine);
  const payouts = ownedBy(scout.state.payouts, user.id);
  const available = availablePayoutCents(mine);

  const columns: TableColumn<Payout>[] = [
    {
      key: "requestedAt",
      header: "Requested",
      render: (row) => <Text>{relativeDay(row.requestedAt)}</Text>,
    },
    {
      key: "amountCents",
      header: "Amount",
      render: (row) => (
        <Text weight="semibold" hasTabularNumbers>
          {formatCents(row.amountCents)}
        </Text>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Text>{row.status === "paid" ? "Paid" : "Processing"}</Text>,
    },
  ];

  const request = () => {
    const result = scout.requestPayout();
    if (!result.ok) {
      toast({ body: result.error, type: "error" });
      return;
    }
    toast({ body: "Payout sent to your demo method." });
  };

  return (
    <Stack gap={6}>
      <PageHeader
        title="Payouts"
        description={`Weekly in production. Minimum ${formatCents(MIN_PAYOUT_CENTS)}. Tier 2 identity and tax info required.`}
        action={
          <Button
            label={`Pay out ${formatCents(available)}`}
            variant="primary"
            clickAction={request}
            isDisabled={!canRequestPayout(user, mine)}
          />
        }
      />
      {user.verificationTier < 2 ? (
        <Banner
          status="warning"
          title="Identity needed for payouts"
          description="Upload a government ID in the demo to reach verification tier 2."
        />
      ) : null}
      <StatGrid
        stats={[
          { label: "Released", value: formatCents(totals.releasedCents) },
          { label: "Paid out", value: formatCents(totals.paidCents) },
          {
            label: "Verification",
            value: `Tier ${user.verificationTier}`,
            hint: user.taxInfoComplete ? "Tax info on file" : "Tax info missing",
          },
        ]}
      />
      <SectionCard
        title="Identity"
        description="Production uses a vendor. Images are not stored here."
      >
        {user.verificationTier >= 2 ? (
          <Text color="secondary">Government ID verified. You can receive payouts.</Text>
        ) : (
          <Stack gap={3}>
            <FileInput
              label="Government ID"
              description="Any file completes the demo check."
              value={idFile}
              onChange={(files) => setIdFile(Array.isArray(files) ? (files[0] ?? null) : files)}
            />
            <Button
              label="Complete ID check"
              variant="secondary"
              clickAction={() => {
                scout.verifyIdentity();
              }}
            />
          </Stack>
        )}
      </SectionCard>
      <SectionCard title="Tax and payout method">
        <Stack gap={4}>
          <Text>
            {user.taxInfoComplete
              ? "W-9 (demo) is on file."
              : "Add tax info before the first transfer."}
          </Text>
          {user.taxInfoComplete ? null : (
            <Button
              label="Save demo tax info"
              variant="secondary"
              clickAction={() => {
                scout.saveTaxInfo();
              }}
            />
          )}
          <TextInput
            label="Account last 4"
            value={last4}
            onChange={setLast4}
            description="Stripe Connect Express in production."
          />
          <Button
            label="Save payout method"
            variant="secondary"
            clickAction={() => {
              scout.savePayoutMethod({ type: "stripe", last4: last4.slice(-4) || "0000" });
            }}
          />
          {user.payoutMethod ? (
            <Text type="supporting" color="secondary">
              On file: {user.payoutMethod.type} · {user.payoutMethod.last4}
            </Text>
          ) : null}
        </Stack>
      </SectionCard>
      <SectionCard title="Transfer history">
        <Table
          caption="Payouts"
          variant="plain"
          columns={columns}
          rows={payouts}
          rowKey={(row) => row.id}
          empty={<Text color="secondary">No transfers yet.</Text>}
        />
      </SectionCard>
    </Stack>
  );
}
