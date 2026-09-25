"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import {
  JobRoomRecord,
  FilterState,
  RoomApplicationsMap,
  ChatMessage,
} from "@/src/shared/types/job-room";
import { CandidateProfile } from "@/src/shared/types/auth";
import { MOCK_JOB_ROOMS } from "@/src/shared/data/mockRooms";
import {
  FALLBACK_CANDIDATE_NAME,
  FALLBACK_CANDIDATE_TITLE,
  FALLBACK_COVER_LETTER,
} from "@/src/shared/data/mockClientData";

interface JobRoomsContextValue {
  rooms: JobRoomRecord[];
  filters: FilterState;
  applicationsRegistry: RoomApplicationsMap;
  updateFilters: (newFilters: Partial<FilterState>) => void;
  applyToJob: (roomId: string, candidateProfile: CandidateProfile & { fullName?: string }) => void;
  postJobRoom: (newJob: Omit<JobRoomRecord, "id" | "postedTimeText" | "proposalsCountText"> & { title: string }) => void;
  sendChatMessage: (roomId: string, candidateId: string, role: "Client" | "Candidate", messageText: string) => void;
  approveProposal: (roomId: string, candidateId: string) => void;
}

const JobRoomsContext = createContext<JobRoomsContextValue | undefined>(undefined);

export function JobRoomsProvider({ children }: { children: React.ReactNode }) {
  const [rooms, setRooms] = useState<JobRoomRecord[]>(MOCK_JOB_ROOMS);
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    experienceLevels: ["Intermediate", "Expert"],
    budgetTypes: ["Hourly"],
  });

  const [applicationsRegistry, setApplicationsRegistry] = useState<RoomApplicationsMap>({
    "room-cmo-001": {
      proposals: [
        {
          id: "cand-alex",
          candidateName: "Alex Miller",
          candidateTitle: "Direct Response Growth Marketer",
          candidateRate: "$65.00/hr",
          coverLetterText:
            "I scale 8-figure ecommerce stores using strict metric-bound visual funnels...",
          status: "Pending",
        },
      ],
      chatHistory: {
        "cand-alex": [
          {
            senderRole: "Candidate",
            text: "Hi, I have reviewed your CMO project criteria. Let me know when you are open to discuss room goals.",
            timestamp: "10:14 AM",
          },
        ],
      },
    },
  });

  const updateFilters = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const applyToJob = (roomId: string, candidateProfile: CandidateProfile & { fullName?: string }) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.id === roomId ? { ...room, proposalsCountText: "In Review" } : room
      )
    );

    setApplicationsRegistry((prev) => {
      const current = prev[roomId] || { proposals: [], chatHistory: {} };
      return {
        ...prev,
        [roomId]: {
          ...current,
          proposals: [
            ...current.proposals,
            {
              id: "logged-in-user",
              candidateName: candidateProfile.fullName || FALLBACK_CANDIDATE_NAME,
              candidateTitle: candidateProfile.title || FALLBACK_CANDIDATE_TITLE,
              candidateRate: `${candidateProfile.hourlyRate}/hr`,
              coverLetterText: candidateProfile.bio || FALLBACK_COVER_LETTER,
              status: "Pending" as const,
            },
          ],
        },
      };
    });
  };

  const postJobRoom = (
    newJob: Omit<JobRoomRecord, "id" | "postedTimeText" | "proposalsCountText"> & { title: string }
  ) => {
    const formulatedRoom: JobRoomRecord = {
      ...newJob,
      id: `room-client-generated-${Date.now()}`,
      postedTimeText: "Posted just now",
      proposalsCountText: "1 applicant",
    };
    setRooms((prev) => [formulatedRoom, ...prev]);
  };

  const sendChatMessage = (
    roomId: string,
    candidateId: string,
    role: "Client" | "Candidate",
    messageText: string
  ) => {
    if (!messageText.trim()) return;
    setApplicationsRegistry((prev) => {
      const roomData = prev[roomId] || { proposals: [], chatHistory: {} };
      const chatLogs = roomData.chatHistory[candidateId] || [];
      const newMsg: ChatMessage = { senderRole: role, text: messageText, timestamp: "Just now" };

      const updatedProposals = roomData.proposals.map((p) =>
        p.id === candidateId && p.status === "Pending" ? { ...p, status: "In Discussion" as const } : p
      );

      return {
        ...prev,
        [roomId]: {
          ...roomData,
          proposals: updatedProposals,
          chatHistory: { ...roomData.chatHistory, [candidateId]: [...chatLogs, newMsg] },
        },
      };
    });
  };

  const approveProposal = (roomId: string, candidateId: string) => {
    setApplicationsRegistry((prev) => {
      const roomData = prev[roomId];
      const finalizedProposals = roomData.proposals.map((p) =>
        p.id === candidateId ? { ...p, status: "Approved" as const } : p
      );
      return { ...prev, [roomId]: { ...roomData, proposals: finalizedProposals } };
    });

    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, proposalsCountText: "Job Awarded / Closed" } : r))
    );
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch =
        room.title.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        room.descriptionParagraph.toLowerCase().includes(filters.searchQuery.toLowerCase());
      const matchesExperience = filters.experienceLevels.includes(room.experienceLevelRequired);
      const matchesBudget = filters.budgetTypes.includes(room.budgetType);
      return matchesSearch && matchesExperience && matchesBudget;
    });
  }, [rooms, filters]);

  const value: JobRoomsContextValue = {
    rooms: filteredRooms,
    filters,
    applicationsRegistry,
    updateFilters,
    applyToJob,
    postJobRoom,
    sendChatMessage,
    approveProposal,
  };

  return <JobRoomsContext.Provider value={value}>{children}</JobRoomsContext.Provider>;
}

export function useJobRoomsContext() {
  const context = useContext(JobRoomsContext);
  if (!context) {
    throw new Error("useJobRoomsContext must be used within a JobRoomsProvider.");
  }
  return context;
}
