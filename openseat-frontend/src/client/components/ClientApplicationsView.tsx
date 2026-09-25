"use client";

import { PageBody } from "@/src/shared/marketplace-ui";
import { ClientApplicationsManager } from "@/src/client/components/ClientApplicationsManager";
import { useClientDashboard } from "@/src/client/hooks/useClientDashboard";

export function ClientApplicationsView() {
  const { clientRooms, applicationsRegistry, handleSendChatMessage, handleApproveProposal } = useClientDashboard();
  return (
    <PageBody>
      <ClientApplicationsManager
        rooms={clientRooms}
        registry={applicationsRegistry}
        onSendMessage={handleSendChatMessage}
        onApprove={handleApproveProposal}
      />
    </PageBody>
  );
}
