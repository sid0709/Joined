"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  Banner,
  Button,
  SectionCard,
  Stack,
  Text,
  TextInput,
} from "@openseat/design-system";
import { ROUTES } from "@/lib/routes";

const CONFIRM = "DELETE";

/** Permanently removes the scout account and everything that belongs to it. */
export function RemoveAccount() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/account", { method: "DELETE" });
    setPending(false);
    if (!response.ok) {
      setConfirming(false);
      setError("Could not remove the account. Try again.");
      return;
    }
    router.push(ROUTES.home);
    router.refresh();
  };

  return (
    <SectionCard
      title="Remove account"
      description="This permanently removes your scout account and the jobs you published."
    >
      <Stack gap={4}>
        {error ? <Banner status="error" title={error} /> : null}
        <Text color="secondary">
          Your profile, submissions, earnings, payouts, and API keys are deleted. Jobs you published
          leave the pool, along with applications to them. This can’t be undone.
        </Text>
        <TextInput
          label={`Type ${CONFIRM} to confirm`}
          value={confirmation}
          onChange={setConfirmation}
          placeholder={CONFIRM}
        />
        <Button
          label="Remove account"
          variant="destructive"
          isDisabled={confirmation !== CONFIRM || pending}
          clickAction={() => setConfirming(true)}
        />
      </Stack>
      <AlertDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        title="Remove your scout account?"
        description="Your account, submissions, and published jobs are deleted. This can’t be undone."
        actionLabel="Remove account"
        actionVariant="destructive"
        onAction={() => void remove()}
      />
    </SectionCard>
  );
}
