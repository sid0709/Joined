"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Banner,
  Button,
  Dialog,
  DialogHeader,
  EmptyState,
  HStack,
  Link,
  Stack,
  Table,
  Text,
  TextArea,
  useToast,
  type TableColumn,
} from "@openseat/design-system";
import {
  ApiError,
  PAYOUT_STATUS,
  formatMoney,
  type Payout,
  type PayoutDecision,
} from "@openseat/scout";
import { adminSend } from "@/lib/api";
import { ageLabel, formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/nav";

const DIALOG_WIDTH = 480;

/** Payout requests with pay and decline actions; declining needs a reason. */
export function PayoutsTable({ rows }: { rows: Payout[] }) {
  const router = useRouter();
  const toast = useToast();
  const [declining, setDeclining] = useState<Payout | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const decide = async (payout: Payout, body: PayoutDecision, done: string) => {
    setError("");
    try {
      await adminSend(`/v1/admin/scout/payouts/${payout.id}/decision`, "POST", body);
      toast({ body: done });
      setDeclining(null);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the decision.");
    }
  };

  const columns: TableColumn<Payout>[] = [
    {
      key: "scout",
      header: "Scout",
      render: (row) => (
        <Stack gap={0.5}>
          <Link href={ROUTES.scout(row.scout_user_id)}>{row.scout_name || "Scout"}</Link>
          <Text type="supporting" color="secondary">
            {row.scout_email}
          </Text>
        </Stack>
      ),
    },
    {
      key: "method",
      header: "Send to",
      render: (row) => (
        <Text type="supporting">
          {row.method.label} •••• {row.method.last4}
        </Text>
      ),
    },
    {
      key: "requested_at",
      header: "Requested",
      render: (row) => (
        <Stack gap={0.5}>
          <Text type="supporting">{formatDate(row.requested_at)}</Text>
          <Text type="supporting" color="secondary">
            {row.status === "requested" ? `waiting ${ageLabel(row.requested_at)}` : row.note || ""}
          </Text>
        </Stack>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      render: (row) => (
        <Text weight="semibold" hasTabularNumbers>
          {formatMoney(row.amount)}
        </Text>
      ),
    },
    {
      key: "status",
      header: "",
      align: "end",
      render: (row) =>
        row.status === "requested" ? (
          <HStack gap={2} hAlign="end">
            <Button
              label="Mark paid"
              variant="primary"
              size="sm"
              clickAction={() =>
                decide(row, { decision: "paid" }, `Marked ${formatMoney(row.amount)} paid.`)
              }
            />
            <Button
              label="Decline"
              variant="ghost"
              size="sm"
              clickAction={() => setDeclining(row)}
            />
          </HStack>
        ) : (
          <Badge
            label={PAYOUT_STATUS[row.status].label}
            variant={PAYOUT_STATUS[row.status].badge}
          />
        ),
    },
  ];

  return (
    <Stack gap={4}>
      {error && !declining ? <Banner status="error" title={error} /> : null}
      <Table
        caption="Payouts"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        empty={
          <EmptyState isCompact title="Nothing here" description="Payout requests show up here." />
        }
      />
      <Dialog
        isOpen={declining !== null}
        onOpenChange={(open) => {
          if (!open) setDeclining(null);
        }}
        width={DIALOG_WIDTH}
        purpose="form"
      >
        <Stack gap={4}>
          <DialogHeader
            title={`Decline ${declining ? formatMoney(declining.amount) : "payout"}?`}
            subtitle="The money goes back to the scout's available balance."
            onOpenChange={(open) => {
              if (!open) setDeclining(null);
            }}
          />
          {error ? <Banner status="error" title={error} /> : null}
          <TextArea
            label="Reason"
            value={note}
            onChange={setNote}
            description="The scout sees this. Say what to fix, like a payout method that bounced."
          />
          <HStack gap={2} hAlign="end">
            <Button label="Cancel" variant="ghost" clickAction={() => setDeclining(null)} />
            <Button
              label="Decline payout"
              variant="destructive"
              isDisabled={!note.trim()}
              clickAction={() =>
                declining
                  ? decide(declining, { decision: "rejected", note }, "Payout declined.")
                  : undefined
              }
            />
          </HStack>
        </Stack>
      </Dialog>
    </Stack>
  );
}
