"use client";

import { useState } from "react";
import { Badge, HStack, TextInput } from "@openseat/design-system";
import type { AuthSession } from "@/lib/auth/types";
import { SaveFooter } from "@/components/save-footer";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";

/** The address you sign in with and candidates' replies reach. */
export function WorkEmailSettings({ session }: { session: AuthSession }) {
  const [email, setEmail] = useState(session.user.email);
  const company = session.company?.name;

  return (
    <SettingsGroup
      title="Work email"
      description="You sign in with it, and candidate replies reach you there."
      footer={
        <SaveFooter hint="Changing it sends a confirmation link." message="Work email saved" />
      }
    >
      <SettingsRow
        label="Email"
        description={
          company ? (
            <HStack gap={2} vAlign="center" wrap="wrap">
              <span>{`Linked to ${company}.`}</span>
              <Badge label="Verified" variant="success" />
            </HStack>
          ) : undefined
        }
      >
        <TextInput label="Email" isLabelHidden type="email" value={email} onChange={setEmail} />
      </SettingsRow>
    </SettingsGroup>
  );
}
