"use client";

import { Button, Stack, useToast } from "@joined/design-system";
import type { AuthSession } from "@/lib/auth/types";
import { PAUSE_DAYS } from "@/lib/settings";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { RemoveAccount } from "./remove-account";

export function DangerSettings({ session }: { session: AuthSession | null }) {
  const toast = useToast();
  const company = session?.company;

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

      <RemoveAccount
        signedIn={session != null}
        companyName={company?.name}
        isCreator={company?.isCreator === true}
      />
    </Stack>
  );
}
