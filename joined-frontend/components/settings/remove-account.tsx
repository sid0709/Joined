"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog, Banner, Button, List, ListItem, TextInput } from "@joined/design-system";
import { DELETE_CONFIRMATION } from "@/lib/settings";
import { ROUTES } from "@/lib/routes";
import { clearApplicationExtras } from "@/lib/application-extras";
import { writeStoredWorkspaceMode } from "@/lib/workspace-preference";
import { SaveFooter } from "@/components/save-footer";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";

type Props = {
  signedIn: boolean;
  companyName?: string;
  isCreator?: boolean;
};

export function RemoveAccount({ signedIn, companyName, isCreator = false }: Props) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const creator = isCreator && Boolean(companyName);
  const consequences = creator
    ? [
        `You created ${companyName}. The company page, its jobs, and activity on those jobs are deleted.`,
        "Teammates lose access to the company.",
        "This can’t be undone.",
      ]
    : companyName
      ? [
          "Your profile is deleted.",
          `You leave ${companyName}. The company page stays.`,
          "This can’t be undone.",
        ]
      : [
          "Your profile, applications, interviews, messages, and saved jobs are deleted.",
          "This can’t be undone.",
        ];

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
    clearApplicationExtras();
    writeStoredWorkspaceMode("hunter");
    router.push(ROUTES.search);
    router.refresh();
  };

  return (
    <SettingsGroup
      title="Remove account"
      description={
        creator
          ? `You created ${companyName}. Removing your profile also deletes that company, its jobs, and activity on those jobs.`
          : "This permanently removes your account."
      }
      footer={
        <SaveFooter
          hint={
            signedIn
              ? `Type ${DELETE_CONFIRMATION} to enable the button.`
              : "Sign in to remove your account."
          }
          message=""
          action={
            <Button
              label="Remove account"
              variant="destructive"
              size="sm"
              isDisabled={!signedIn || confirmation !== DELETE_CONFIRMATION || pending}
              onClick={() => setConfirming(true)}
            />
          }
        />
      }
    >
      {error ? <Banner status="error" title={error} /> : null}
      <List listStyle="disc">
        {consequences.map((item) => (
          <ListItem key={item} label={item} />
        ))}
      </List>
      <SettingsRow
        label="Confirm"
        description={`Type ${DELETE_CONFIRMATION} to enable the button.`}
      >
        <TextInput
          label="Confirm removal"
          isLabelHidden
          value={confirmation}
          onChange={setConfirmation}
          placeholder={DELETE_CONFIRMATION}
          isDisabled={!signedIn}
        />
      </SettingsRow>
      <AlertDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        title={creator ? "Remove your account and company?" : "Remove your account?"}
        description={
          creator
            ? `You created ${companyName}. Once you remove your profile, the company page is deleted too. This can’t be undone.`
            : "Your account is removed. This can’t be undone."
        }
        actionLabel="Remove account"
        actionVariant="destructive"
        onAction={() => void remove()}
      />
    </SettingsGroup>
  );
}
