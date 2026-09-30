"use client";

import { ClientWorkspace } from "@/src/client/components/ClientWorkspace";
import { useClientDashboard } from "@/src/client/hooks/useClientDashboard";
import { PageBody } from "@/src/shared/marketplace-ui";

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
