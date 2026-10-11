import type { Metadata } from "next";
import { Stack } from "sid-ui";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { ComponentList } from "@/components/status/component-list";
import { IncidentCard } from "@/components/status/incident-card";
import { IncidentHistory } from "@/components/status/incident-history";
import { StatusSummary } from "@/components/status/status-summary";
import { loadStatus } from "@/lib/status";

export const metadata: Metadata = {
  title: "Status",
  description: "Whether Joined is working right now, uptime for the last 90 days, and incidents.",
};

export default async function StatusPage() {
  const page = await loadStatus();
  return (
    <PageContainer>
      <PageHeader
        title="Joined status"
        description="Live checks of the site, the API, and search."
      />
      <StatusSummary page={page} />
      {page ? (
        <Stack gap={5}>
          {(page.activeIncidents ?? []).map((incident) => (
            <IncidentCard key={incident.id} incident={incident} components={page.components} />
          ))}
          <ComponentList components={page.components} />
          <IncidentHistory history={page.history} />
        </Stack>
      ) : null}
    </PageContainer>
  );
}
