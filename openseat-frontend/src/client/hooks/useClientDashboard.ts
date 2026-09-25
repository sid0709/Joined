"use client";

import { useJobRoomsContext } from "@/src/shared/job-rooms/JobRoomsContext";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";
import { ClientJobPost } from "@/src/client/types";
import {
  DEFAULT_CLIENT_LOCATION,
  DEFAULT_CLIENT_SPEND,
} from "@/src/shared/data/mockClientData";

export function useClientDashboard() {
  const { rooms, applicationsRegistry, postJobRoom, sendChatMessage, approveProposal } = useJobRoomsContext();
  const { currentUser, logoutUser } = useMockAuth();

  const clientRooms = rooms.filter(
    (r) => r.id.startsWith("room-client-generated-") || r.id === "room-cmo-001"
  );

  const postedRooms = rooms.filter((r) => r.id.startsWith("room-client-generated-"));

  const handlePostJob = (job: ClientJobPost) => {
    postJobRoom({
      title: job.title,
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
    currentUser,
    logoutUser,
  };
}
