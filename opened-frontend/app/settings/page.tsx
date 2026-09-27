import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { SettingsPanel } from "@/components/settings-panel";
import { SETTINGS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: SETTINGS_PAGE.label };

export default function SettingsPage() {
  return (
    <Stack gap={5}>
      <PageHeader title={SETTINGS_PAGE.label} description={SETTINGS_PAGE.description} />
      <SettingsPanel />
    </Stack>
  );
}
