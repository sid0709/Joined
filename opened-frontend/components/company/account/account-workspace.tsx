"use client";

import type { ReactNode } from "react";
import { Stack } from "@openseat/design-system";
import { SectionedSettings } from "@/components/sectioned-settings";
import { ConnectionSettings } from "@/components/settings/connection-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { RemoveAccount } from "@/components/settings/remove-account";
import { SignInSecurity } from "@/components/settings/sign-in-security";
import type { AuthSession } from "@/lib/auth/types";
import {
  ACCOUNT_NAV,
  HIRING_CONNECTIONS,
  HIRING_CONNECTIONS_NOTICE,
  HIRING_NOTIFICATION_EVENTS,
  type AccountSectionId,
} from "@/lib/company";
import { WorkEmailSettings } from "./work-email-settings";

/**
 * Your own settings in the hiring workspace — sign-in, notifications, and the
 * tools you interview with. Nothing here changes the company for anyone else.
 */
export function AccountWorkspace({ session }: { session: AuthSession }) {
  const company = session.company;
  const panels: Record<AccountSectionId, ReactNode> = {
    account: (
      <Stack gap={6}>
        <WorkEmailSettings session={session} />
        <SignInSecurity />
      </Stack>
    ),
    notifications: <NotificationSettings events={HIRING_NOTIFICATION_EVENTS} />,
    connections: (
      <ConnectionSettings connections={HIRING_CONNECTIONS} notice={HIRING_CONNECTIONS_NOTICE} />
    ),
    danger: (
      <RemoveAccount signedIn companyName={company?.name} isCreator={company?.isCreator === true} />
    ),
  };

  return <SectionedSettings nav={ACCOUNT_NAV} panels={panels} />;
}
