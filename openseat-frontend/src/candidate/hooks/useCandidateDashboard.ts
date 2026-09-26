"use client";

import { useJobRoomsContext } from "@/src/shared/job-rooms/JobRoomsContext";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";

export function useCandidateDashboard() {
  const { rooms, allRooms, applicationsRegistry, filters, updateFilters, applyToJob } = useJobRoomsContext();
  const { currentUser, profile } = useMockAuth();

  const handleApplyToJob = (roomId: string) => {
    applyToJob(roomId, { ...profile, fullName: currentUser?.fullName, email: currentUser?.email });
  };

  return {
    rooms,
    allRooms,
    applicationsRegistry,
    filters,
    updateFilters,
    handleApplyToJob,
    currentUser,
    profile,
  };
}
