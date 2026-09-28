"use client";

import { ClientApplicationsManager } from "@/src/client/components/ClientApplicationsManager";
import { useClientDashboard } from "@/src/client/hooks/useClientDashboard";
import { PageBody } from "@/src/shared/marketplace-ui";

export function ClientApplicationsView({ fullPage = false }: { fullPage?: boolean }) {
  const {
    clientRooms,
    applicationsRegistry,
    handleSendChatMessage,
    handleApproveProposal,
    handleReviewProposal,
    handleUpdateProposalNote,
  } = useClientDashboard();
  return (
    <PageBody className={fullPage ? "marketplace-page-body-wide" : undefined}>
      <ClientApplicationsManager
        rooms={clientRooms}
        registry={applicationsRegistry}
        onSendMessage={handleSendChatMessage}
        onApprove={handleApproveProposal}
        onReviewProposal={handleReviewProposal}
        onUpdateProposalNote={handleUpdateProposalNote}
        fullPage={fullPage}
      />
    </PageBody>
  );
}
