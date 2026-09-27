import type { Metadata } from "next";
import { Card, List, ListItem, Stack, Text } from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { COMPANY_SETTINGS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: "Company settings" };

export default function CompanySettingsPage() {
  return (
    <Stack gap={5} maxWidth={720}>
      <PageHeader title={COMPANY_SETTINGS_PAGE.label} description={COMPANY_SETTINGS_PAGE.description} />
      <Card padding={2}>
        <List hasDividers header={<Text type="label">Company</Text>}>
          <ListItem label="Domains" description="northwind.example — verified" />
          <ListItem label="Notifications" description="Email the owner when spend reaches the cap." />
          <ListItem label="Default assisted policy" description="Accept assisted applications unless a job says otherwise." />
        </List>
      </Card>
    </Stack>
  );
}
