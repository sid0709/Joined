"use client";

import { useState } from "react";
import { Button, List, ListItem, Stack, TextInput, useToast } from "@openseat/design-system";
import { DELETE_CONFIRMATION, PAUSE_DAYS } from "@/lib/settings";
import { SaveFooter } from "./save-footer";
import { SettingsGroup, SettingsRow } from "./settings-group";

const CONSEQUENCES = [
  "Your profile, resumes, and saved jobs are deleted.",
  "Companies keep applications you already sent.",
  "Company memberships stay until an owner removes you.",
];

export function DangerSettings() {
  const toast = useToast();
  const [confirmation, setConfirmation] = useState("");

  return (
    <Stack gap={6}>
      <SettingsGroup
        title="Taking a break?"
        description="Pausing keeps everything and hides you until you’re back."
      >
        <SettingsRow
          label={`Pause for ${PAUSE_DAYS} days`}
          description="Alerts stop and your profile is hidden from search."
          layout="inline"
        >
          <Button
            label="Pause job search"
            variant="secondary"
            size="sm"
            onClick={() => toast({ body: `Paused for ${PAUSE_DAYS} days` })}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title="Delete account"
        description="This can’t be undone."
        footer={
          <SaveFooter
            hint="We’ll email you to confirm before anything is removed."
            message=""
            action={
              <Button
                label="Delete account"
                variant="destructive"
                size="sm"
                isDisabled={confirmation !== DELETE_CONFIRMATION}
                onClick={() => {
                  setConfirmation("");
                  toast({ body: "Deletion requested. Check your email to finish.", type: "error" });
                }}
              />
            }
          />
        }
      >
        <List listStyle="disc">
          {CONSEQUENCES.map((item) => (
            <ListItem key={item} label={item} />
          ))}
        </List>
        <SettingsRow
          label="Confirm"
          description={`Type ${DELETE_CONFIRMATION} to enable the button.`}
        >
          <TextInput
            label="Confirm deletion"
            isLabelHidden
            value={confirmation}
            onChange={setConfirmation}
            placeholder={DELETE_CONFIRMATION}
          />
        </SettingsRow>
      </SettingsGroup>
    </Stack>
  );
}
