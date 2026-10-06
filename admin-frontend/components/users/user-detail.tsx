"use client";

import { useState } from "react";
import { ApiError } from "@joined/scout";
import { AlertDialog, Banner, PageHeader, Stack, Text, TextInput } from "sid-ui";
import { ReasonActions } from "@/components/trust/reason-actions";
import { useAdminQuery } from "@/lib/use-admin-query";
import {
  canSubmitUserAction,
  runUserAction,
  userDetailPath,
  type AdminUser,
  type UserAction,
} from "@/lib/users";

const ACTIONS: {
  id: UserAction;
  label: string;
  variant: "primary" | "secondary" | "destructive";
}[] = [
  { id: "suspend", label: "Suspend login", variant: "destructive" },
  { id: "unsuspend", label: "Restore login", variant: "secondary" },
  { id: "cancel", label: "Cancel Premium", variant: "destructive" },
  { id: "refund", label: "Refund", variant: "secondary" },
];

export function UserDetail({ id }: { id: string }) {
  const { result, loading, error, errorStatus, reload } = useAdminQuery<AdminUser>(
    userDetailPath(id),
  );
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [pendingAction, setPendingAction] = useState<UserAction | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const cents = Number(amount);
  const amountCents = Number.isInteger(cents) && cents > 0 ? cents : undefined;

  const confirm = async () => {
    if (
      !pendingAction ||
      !canSubmitUserAction(reason, pendingAction === "refund" ? amountCents : undefined)
    ) {
      return;
    }
    setPending(true);
    setActionError("");
    try {
      const outcome = await runUserAction(
        id,
        pendingAction,
        reason,
        pendingAction === "refund" ? amountCents : undefined,
      );
      setNotice(`Recorded ${outcome.auditId}.`);
      setPendingAction(null);
      reload();
    } catch (cause) {
      setActionError(
        cause instanceof ApiError && cause.status === 401
          ? "Sign in again to update this user."
          : cause instanceof Error
            ? cause.message
            : "Could not update the user.",
      );
      setPendingAction(null);
    } finally {
      setPending(false);
    }
  };

  return (
    <Stack gap={4}>
      <PageHeader
        title={result?.name || "User"}
        description="Masked profile. Actions need a reason."
      />
      {loading ? <Text color="secondary">Loading…</Text> : null}
      {errorStatus === 404 ? <Banner status="warning" title="That user was not found." /> : null}
      {errorStatus === 401 ? (
        <Banner status="error" title="Sign in again to view this user." />
      ) : null}
      {error && errorStatus !== 404 && errorStatus !== 401 ? (
        <Banner status="error" title={error} />
      ) : null}
      {notice ? <Banner status="success" title={notice} /> : null}
      {result ? (
        <Stack gap={1}>
          <Text>{result.email}</Text>
          <Text color="secondary">{result.role}</Text>
          <Text color="secondary">{result.suspended ? "Login suspended" : "Login allowed"}</Text>
          <Text color="secondary">
            {result.premium ? `Premium ${result.premiumStatus}` : "Not Premium"}
          </Text>
          {result.timeline.map((event) => (
            <Text key={`${event.label}-${event.at}`} color="secondary">
              {event.label}
            </Text>
          ))}
        </Stack>
      ) : null}
      <TextInput label="Refund amount (cents)" value={amount} onChange={setAmount} />
      <ReasonActions
        description="Cancel, refund, and suspend stay disabled until the reason is filled in."
        actions={ACTIONS}
        pending={pending}
        error={actionError}
        onSubmit={(actionId, nextReason) => {
          setReason(nextReason);
          const action = actionId as UserAction;
          if (!canSubmitUserAction(nextReason, action === "refund" ? amountCents : undefined)) {
            setActionError(
              action === "refund"
                ? "Enter a reason and a positive amount in cents."
                : "Add a reason.",
            );
            return;
          }
          setPendingAction(action);
        }}
      />
      <AlertDialog
        isOpen={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        title="Confirm this user action?"
        description={
          pendingAction ? `This sends ${pendingAction} with the reason you entered.` : ""
        }
        actionLabel="Confirm"
        actionVariant="destructive"
        onAction={() => {
          void confirm();
        }}
      />
    </Stack>
  );
}
