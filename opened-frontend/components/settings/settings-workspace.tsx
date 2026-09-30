"use client";

import { useState, type ReactNode } from "react";
import {
  GridColumn,
  GridSystem,
  Heading,
  Icon,
  SideNav,
  SideNavItem,
  SideNavSection,
  Stack,
  Text,
  icons,
} from "@openseat/design-system";
import type { AuthSession } from "@/lib/auth/types";
import { SETTINGS_NAV, SETTINGS_SECTIONS, type SettingsSectionId } from "@/lib/settings";
import { AccountSettings } from "./account-settings";
import { AlertSettings } from "./alert-settings";
import { ConnectionSettings } from "./connection-settings";
import { DangerSettings } from "./danger-settings";
import { NotificationSettings } from "./notification-settings";
import { PrivacySettings } from "./privacy-settings";

/** A grouped nav on the left; the chosen section’s title and cards on the right. */
export function SettingsWorkspace({
  session,
  googleEmail,
  calendarResult,
}: {
  session: AuthSession | null;
  googleEmail?: string;
  calendarResult?: string;
}) {
  const panels: Record<SettingsSectionId, ReactNode> = {
    account: <AccountSettings session={session} />,
    notifications: <NotificationSettings />,
    alerts: <AlertSettings />,
    connections: <ConnectionSettings googleEmail={googleEmail} calendarResult={calendarResult} />,
    privacy: <PrivacySettings />,
    danger: <DangerSettings session={session} />,
  };
  const [section, setSection] = useState<SettingsSectionId>(
    calendarResult ? "connections" : "account",
  );
  const current = SETTINGS_SECTIONS.find((item) => item.id === section) ?? SETTINGS_SECTIONS[0];

  return (
    <GridSystem gap={6} align="start">
      <GridColumn span="full" lg={3}>
        <SideNav>
          {SETTINGS_NAV.map((group) => (
            <SideNavSection key={group.title} title={group.title}>
              {group.sections.map((item) => (
                <SideNavItem
                  key={item.id}
                  label={item.label}
                  icon={<Icon icon={icons[item.icon]} />}
                  isSelected={item.id === section}
                  onClick={() => setSection(item.id)}
                />
              ))}
            </SideNavSection>
          ))}
        </SideNav>
      </GridColumn>
      <GridColumn span="full" lg={9}>
        <Stack gap={6}>
          <Stack gap={1}>
            <Heading level={2}>{current.label}</Heading>
            <Text color="secondary" display="block">
              {current.description}
            </Text>
          </Stack>
          {panels[section]}
        </Stack>
      </GridColumn>
    </GridSystem>
  );
}
