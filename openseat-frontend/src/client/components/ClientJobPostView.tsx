"use client";

import { PageBody } from "@/src/shared/marketplace-ui";
import { ClientWorkspace } from "@/src/client/components/ClientWorkspace";
import { useClientDashboard } from "@/src/client/hooks/useClientDashboard";

export function ClientJobPostView() {
  const { handlePostJob } = useClientDashboard();
  return (
    <PageBody>
      <div className="marketplace-narrow-page">
        <ClientWorkspace onPostJob={handlePostJob} />
      </div>
    </PageBody>
  );
}
