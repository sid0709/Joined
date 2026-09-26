"use client";

import { useJobRoomsContext } from "@/src/shared/job-rooms/JobRoomsContext";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";
import { ClientJobPost } from "@/src/client/types";
import {
  DEFAULT_CLIENT_LOCATION,
  DEFAULT_CLIENT_SPEND,
} from "@/src/shared/data/mockClientData";

export function useClientDashboard() {
  const { allRooms, applicationsRegistry, postJobRoom, sendChatMessage, approveProposal, reviewProposal, updateProposalNote } = useJobRoomsContext();
  const { currentUser } = useMockAuth();

  const clientRooms = allRooms.filter(
    (r) => r.id.startsWith("room-client-generated-") || r.id === "room-cmo-001"
  );

  const postedRooms = allRooms.filter((r) => r.id.startsWith("room-client-generated-"));

  const handlePostJob = (job: ClientJobPost) => {
    postJobRoom({
      title: job.title,
      sourceCompany: job.sourceCompany,
      sourceUrl: job.sourceUrl,
      applicationDeadline: job.applicationDeadline,
      sourceJobStatus: "Open",
      isPaymentVerified: true,
      clientTotalSpentText: DEFAULT_CLIENT_SPEND,
      clientLocationCode: DEFAULT_CLIENT_LOCATION,
      budgetType: job.budgetType,
      rateOrBudgetRangeText: job.rateOrBudgetRangeText,
      experienceLevelRequired: job.experienceLevelRequired,
      durationEstimateText: job.durationEstimateText,
      weeklyCommitmentText: job.weeklyCommitmentText,
      descriptionParagraph: job.descriptionParagraph,
      skillsTags: job.skillsTags,
    });
  };

  return {
    clientRooms,
    postedRooms,
    applicationsRegistry,
    handlePostJob,
    handleSendChatMessage: sendChatMessage,
    handleApproveProposal: approveProposal,
    handleReviewProposal: reviewProposal,
    handleUpdateProposalNote: updateProposalNote,
    currentUser,
  };
}
