"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import {
  ChatMessage,
  JobRoomRecord,
  JobRoomWorkflow,
  FilterState,
  MilestoneRecord,
  ProposalDraft,
  ProposalRecord,
  ProposalReviewAction,
  RoomApplicationsMap,
  RoomFileRecord,
  RoomReviewRecord,
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
  allRooms: JobRoomRecord[];
  filters: FilterState;
  applicationsRegistry: RoomApplicationsMap;
  updateFilters: (newFilters: Partial<FilterState>) => void;
  applyToJob: (roomId: string, candidateProfile: CandidateProfile & { fullName?: string; email?: string }, proposalDraft?: ProposalDraft) => void;
  postJobRoom: (newJob: Omit<JobRoomRecord, "id" | "postedTimeText" | "proposalsCountText" | "workflow"> & { title: string }) => void;
  sendChatMessage: (roomId: string, candidateId: string, role: "Client" | "Candidate", messageText: string) => void;
  approveProposal: (roomId: string, candidateId: string) => void;
  reviewProposal: (roomId: string, candidateId: string, action: ProposalReviewAction) => void;
  respondToInvitation: (roomId: string, candidateId: string, response: "accept" | "decline") => void;
  updateProposalNote: (roomId: string, candidateId: string, note: string) => void;
  fundMilestone: (roomId: string, milestoneId: string) => void;
  submitMilestoneWork: (roomId: string, milestoneId: string, summary: string) => void;
  reviewMilestone: (roomId: string, milestoneId: string, decision: "approve" | "changes", feedbackText?: string) => void;
  addRoomFile: (roomId: string, file: Omit<RoomFileRecord, "id" | "uploadedAt">) => void;
  openDispute: (roomId: string, role: "Client" | "Candidate", reason: string) => void;
  resolveDispute: (roomId: string, resolution: "release" | "refund") => void;
  addReview: (roomId: string, role: "Client" | "Candidate", rating: number, text: string) => void;
}

const JobRoomsContext = createContext<JobRoomsContextValue | undefined>(undefined);

function emptyWorkflow(paymentVerified = false): JobRoomWorkflow {
  return {
    proposals: [],
    chatHistory: {},
    selectedCandidateId: null,
    shortlistIds: [],
    invitedCandidateIds: [],
    milestones: [],
    files: [],
    deliveryHistory: [],
    reviews: [],
    trust: {
      paymentVerified,
      clientIdentityVerified: paymentVerified,
      candidateIdentityVerified: false,
      escrowStatus: "Not funded",
      reviewEligible: false,
    },
    workStatus: "Open",
  };
}

const alexProposal: ProposalRecord = {
  id: "cand-alex",
  candidateName: "Alex Miller",
  candidateTitle: "Direct Response Growth Marketer",
  candidateRate: "$65.00/hr",
  estimatedTimelineText: "2 weeks to strategy and first experiments",
  availabilityText: "30+ hrs/week · Starts next Monday",
  coverLetterText: "I scale 8-figure ecommerce stores using strict metric-bound visual funnels and a disciplined test-and-learn loop.",
  milestones: [
    { id: "alex-m1", title: "Growth audit", deliverable: "Funnel audit, opportunity map, and measurement plan.", amountText: "$2,400", dueDate: "2026-10-09" },
    { id: "alex-m2", title: "Experiment launch", deliverable: "Launch the first three experiments and a weekly reporting cadence.", amountText: "$3,600", dueDate: "2026-10-23" },
  ],
  workExamples: [
    { id: "alex-example-1", title: "DTC retention relaunch", url: "https://example.com/case-study", summary: "Reworked lifecycle journeys and testing cadence for a scaled ecommerce brand." },
  ],
  identityVerified: true,
  status: "Pending",
};

const INITIAL_WORKFLOWS: Record<string, JobRoomWorkflow> = {
  "room-cmo-001": {
    ...emptyWorkflow(true),
    proposals: [alexProposal],
    chatHistory: {
      "cand-alex": [
        {
          senderRole: "Candidate",
          text: "Hi, I have reviewed your CMO project criteria. Let me know when you are open to discuss room goals.",
          timestamp: "10:14 AM",
        },
      ],
    },
    trust: {
      ...emptyWorkflow(true).trust,
      candidateIdentityVerified: true,
    },
    workStatus: "Reviewing",
  },
};

function initialRooms() {
  return MOCK_JOB_ROOMS.map((room) => ({
    ...room,
    workflow: INITIAL_WORKFLOWS[room.id] ?? emptyWorkflow(room.isPaymentVerified),
  }));
}

function defaultProposalDraft(profile: CandidateProfile): ProposalDraft {
  return {
    candidateRate: `${profile.hourlyRate}/hr`,
    estimatedTimelineText: "1 to 3 months",
    availabilityText: "20+ hrs/week · Available to start soon",
    coverLetterText: profile.bio || FALLBACK_COVER_LETTER,
    milestones: [
      { id: `milestone-${Date.now()}-1`, title: "Discovery and plan", deliverable: "Align on requirements, risks, and the first delivery plan.", amountText: "25% of project", dueDate: "Week 1" },
      { id: `milestone-${Date.now()}-2`, title: "Build and handoff", deliverable: "Deliver the agreed implementation, walkthrough, and handoff notes.", amountText: "75% of project", dueDate: "Final week" },
    ],
    workExamples: [],
  };
}

function milestoneRecordsFromProposal(proposal: ProposalRecord): MilestoneRecord[] {
  const proposalMilestones = proposal.milestones.length ? proposal.milestones : [
    { id: `${proposal.id}-milestone-1`, title: "Project kickoff", deliverable: "Confirm requirements and working agreement.", amountText: proposal.candidateRate, dueDate: "Week 1" },
  ];
  return proposalMilestones.map((milestone) => ({ ...milestone, status: "Proposed" as const }));
}

function updateRoom(
  setRooms: React.Dispatch<React.SetStateAction<JobRoomRecord[]>>,
  roomId: string,
  update: (room: JobRoomRecord, workflow: JobRoomWorkflow) => JobRoomRecord,
) {
  setRooms((previous) => previous.map((room) => update(room, room.workflow ?? emptyWorkflow(room.isPaymentVerified))));
}

export function JobRoomsProvider({ children }: { children: React.ReactNode }) {
  const [allRooms, setRooms] = useState<JobRoomRecord[]>(initialRooms);
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    experienceLevels: ["Entry Level", "Intermediate", "Expert"],
    budgetTypes: ["Hourly", "Fixed-Price"],
  });

  const updateFilters = (newFilters: Partial<FilterState>) => {
    setFilters((previous) => ({ ...previous, ...newFilters }));
  };

  const applyToJob = (
    roomId: string,
    candidateProfile: CandidateProfile & { fullName?: string; email?: string },
    proposalDraft?: ProposalDraft,
  ) => {
    const candidateId = candidateProfile.email || "logged-in-user";
    const draft = proposalDraft ?? defaultProposalDraft(candidateProfile);

    updateRoom(setRooms, roomId, (room, workflow) => {
      if (workflow.proposals.some((proposal) => proposal.id === candidateId)) return room;
      const proposal: ProposalRecord = {
        ...draft,
        id: candidateId,
        candidateEmail: candidateProfile.email,
        candidateName: candidateProfile.fullName || FALLBACK_CANDIDATE_NAME,
        candidateTitle: candidateProfile.title || FALLBACK_CANDIDATE_TITLE,
        status: "Pending",
      };
      return {
        ...room,
        proposalsCountText: "In Review",
        workflow: {
          ...workflow,
          proposals: [...workflow.proposals, proposal],
          workStatus: "Reviewing",
        },
      };
    });
  };

  const postJobRoom = (
    newJob: Omit<JobRoomRecord, "id" | "postedTimeText" | "proposalsCountText" | "workflow"> & { title: string },
  ) => {
    const formulatedRoom: JobRoomRecord = {
      ...newJob,
      id: `room-client-generated-${Date.now()}`,
      postedTimeText: "Posted just now",
      proposalsCountText: "0 proposals",
      workflow: emptyWorkflow(newJob.isPaymentVerified),
    };
    setRooms((previous) => [formulatedRoom, ...previous]);
  };

  const sendChatMessage = (roomId: string, candidateId: string, role: "Client" | "Candidate", messageText: string) => {
    if (!messageText.trim()) return;
    updateRoom(setRooms, roomId, (room, workflow) => {
      const chatLogs = workflow.chatHistory[candidateId] || [];
      const newMessage: ChatMessage = { senderRole: role, text: messageText.trim(), timestamp: "Just now" };
      const updatedProposals = workflow.proposals.map((proposal) =>
        proposal.id === candidateId && ["Pending", "Shortlisted", "Invited"].includes(proposal.status)
          ? { ...proposal, status: "In Discussion" as const }
          : proposal,
      );
      return {
        ...room,
        workflow: {
          ...workflow,
          proposals: updatedProposals,
          chatHistory: { ...workflow.chatHistory, [candidateId]: [...chatLogs, newMessage] },
        },
      };
    });
  };

  const reviewProposal = (roomId: string, candidateId: string, action: ProposalReviewAction) => {
    updateRoom(setRooms, roomId, (room, workflow) => {
      const statusByAction: Record<ProposalReviewAction, ProposalRecord["status"]> = {
        shortlist: "Shortlisted",
        invite: "Invited",
        reject: "Rejected",
        archive: "Archived",
        restore: "Pending",
      };
      const status = statusByAction[action];
      const updateIds = (ids: string[], shouldInclude: boolean) => shouldInclude
        ? Array.from(new Set([...ids, candidateId]))
        : ids.filter((id) => id !== candidateId);
      const shouldShortlist = action === "shortlist" || (action !== "reject" && workflow.shortlistIds.includes(candidateId));
      const shouldInvite = action === "invite" || (action !== "reject" && workflow.invitedCandidateIds.includes(candidateId));
      return {
        ...room,
        workflow: {
          ...workflow,
          proposals: workflow.proposals.map((proposal) => proposal.id === candidateId ? { ...proposal, status } : proposal),
          shortlistIds: updateIds(workflow.shortlistIds, shouldShortlist),
          invitedCandidateIds: updateIds(workflow.invitedCandidateIds, shouldInvite),
          workStatus: workflow.workStatus === "Open" ? "Reviewing" : workflow.workStatus,
        },
      };
    });
  };

  const respondToInvitation = (roomId: string, candidateId: string, response: "accept" | "decline") => {
    updateRoom(setRooms, roomId, (room, workflow) => {
      const proposal = workflow.proposals.find((item) => item.id === candidateId);
      if (!proposal) return room;
      const nextStatus = response === "accept" ? "In Discussion" : "Rejected";
      const message: ChatMessage = {
        senderRole: "Candidate",
        text: response === "accept" ? "I accept the invitation. I am ready to discuss the brief and schedule the next step." : "Thank you for the invitation. I am declining this opportunity.",
        timestamp: "Just now",
      };
      return {
        ...room,
        workflow: {
          ...workflow,
          proposals: workflow.proposals.map((item) => item.id === candidateId ? { ...item, status: nextStatus as ProposalRecord["status"] } : item),
          chatHistory: { ...workflow.chatHistory, [candidateId]: [...(workflow.chatHistory[candidateId] ?? []), message] },
        },
      };
    });
  };

  const updateProposalNote = (roomId: string, candidateId: string, note: string) => {
    updateRoom(setRooms, roomId, (room, workflow) => ({
      ...room,
      workflow: {
        ...workflow,
        proposals: workflow.proposals.map((proposal) => proposal.id === candidateId ? { ...proposal, clientNote: note } : proposal),
      },
    }));
  };

  const approveProposal = (roomId: string, candidateId: string) => {
    updateRoom(setRooms, roomId, (room, workflow) => {
      const selectedProposal = workflow.proposals.find((proposal) => proposal.id === candidateId);
      if (!selectedProposal) return room;
      return {
        ...room,
        proposalsCountText: "Job Awarded / Closed",
        workflow: {
          ...workflow,
          proposals: workflow.proposals.map((proposal) => proposal.id === candidateId ? { ...proposal, status: "Approved" as const } : proposal),
          selectedCandidateId: candidateId,
          milestones: milestoneRecordsFromProposal(selectedProposal),
          workStatus: "Awarded",
          trust: {
            ...workflow.trust,
            candidateIdentityVerified: Boolean(selectedProposal.identityVerified),
            reviewEligible: true,
          },
        },
      };
    });
  };

  const fundMilestone = (roomId: string, milestoneId: string) => {
    updateRoom(setRooms, roomId, (room, workflow) => ({
      ...room,
      workflow: {
        ...workflow,
        milestones: workflow.milestones.map((milestone) => milestone.id === milestoneId ? { ...milestone, status: "Funded" as const } : milestone),
        workStatus: "In Progress",
        trust: { ...workflow.trust, escrowStatus: "Funded" },
      },
    }));
  };

  const submitMilestoneWork = (roomId: string, milestoneId: string, summary: string) => {
    if (!summary.trim()) return;
    updateRoom(setRooms, roomId, (room, workflow) => {
      const milestone = workflow.milestones.find((item) => item.id === milestoneId);
      if (!milestone) return room;
      const delivery = {
        id: `delivery-${Date.now()}`,
        milestoneId,
        milestoneTitle: milestone.title,
        summary: summary.trim(),
        submittedAt: "Just now",
        status: "Submitted" as const,
        fileIds: [],
      };
      return {
        ...room,
        workflow: {
          ...workflow,
          milestones: workflow.milestones.map((item) => item.id === milestoneId ? { ...item, status: "In Review" as const, submittedAt: "Just now" } : item),
          deliveryHistory: [delivery, ...workflow.deliveryHistory],
          workStatus: "In Review",
        },
      };
    });
  };

  const reviewMilestone = (roomId: string, milestoneId: string, decision: "approve" | "changes", feedbackText = "") => {
    updateRoom(setRooms, roomId, (room, workflow) => {
      const nextStatus = decision === "approve" ? "Paid" : "Changes Requested";
      const nextMilestones = workflow.milestones.map((milestone) => milestone.id === milestoneId
        ? { ...milestone, status: nextStatus as MilestoneRecord["status"], approvedAt: decision === "approve" ? "Just now" : undefined, feedbackText }
        : milestone);
      const allPaid = nextMilestones.length > 0 && nextMilestones.every((milestone) => milestone.status === "Paid");
      return {
        ...room,
        workflow: {
          ...workflow,
          milestones: nextMilestones,
          deliveryHistory: workflow.deliveryHistory.map((delivery) => delivery.milestoneId === milestoneId
            ? { ...delivery, status: decision === "approve" ? "Approved" as const : "Changes Requested" as const }
            : delivery),
          workStatus: allPaid ? "Completed" : "In Progress",
          trust: {
            ...workflow.trust,
            escrowStatus: allPaid ? "Released" : decision === "approve" ? "Partially released" : workflow.trust.escrowStatus,
            reviewEligible: !allPaid,
          },
        },
      };
    });
  };

  const addRoomFile = (roomId: string, file: Omit<RoomFileRecord, "id" | "uploadedAt">) => {
    updateRoom(setRooms, roomId, (room, workflow) => ({
      ...room,
      workflow: {
        ...workflow,
        files: [{ ...file, id: `file-${Date.now()}`, uploadedAt: "Just now" }, ...workflow.files],
      },
    }));
  };

  const openDispute = (roomId: string, role: "Client" | "Candidate", reason: string) => {
    if (!reason.trim()) return;
    updateRoom(setRooms, roomId, (room, workflow) => ({
      ...room,
      workflow: {
        ...workflow,
        dispute: { id: `dispute-${Date.now()}`, openedByRole: role, reason: reason.trim(), openedAt: "Just now", status: "Open" },
        workStatus: "Disputed",
        trust: { ...workflow.trust, escrowStatus: "On hold" },
      },
    }));
  };

  const resolveDispute = (roomId: string, resolution: "release" | "refund") => {
    updateRoom(setRooms, roomId, (room, workflow) => ({
      ...room,
      workflow: {
        ...workflow,
        dispute: workflow.dispute ? { ...workflow.dispute, status: "Resolved" } : workflow.dispute,
        workStatus: "In Progress",
        trust: { ...workflow.trust, escrowStatus: resolution === "release" ? "Partially released" : "Refunded" },
      },
    }));
  };

  const addReview = (roomId: string, role: "Client" | "Candidate", rating: number, text: string) => {
    if (!text.trim() || rating < 1 || rating > 5) return;
    updateRoom(setRooms, roomId, (room, workflow) => {
      if (workflow.reviews.some((review) => review.authorRole === role)) return room;
      const review: RoomReviewRecord = {
        id: `review-${Date.now()}`,
        authorRole: role,
        rating,
        text: text.trim(),
        createdAt: "Just now",
      };
      return { ...room, workflow: { ...workflow, reviews: [...workflow.reviews, review] } };
    });
  };

  const filteredRooms = useMemo(() => allRooms.filter((room) => {
    const matchesSearch = room.title.toLowerCase().includes(filters.searchQuery.toLowerCase()) || room.descriptionParagraph.toLowerCase().includes(filters.searchQuery.toLowerCase());
    const matchesExperience = filters.experienceLevels.includes(room.experienceLevelRequired);
    const matchesBudget = filters.budgetTypes.includes(room.budgetType);
    return matchesSearch && matchesExperience && matchesBudget;
  }), [allRooms, filters]);

  const applicationsRegistry = useMemo(() => Object.fromEntries(
    allRooms.map((room) => [room.id, room.workflow ?? emptyWorkflow(room.isPaymentVerified)]),
  ) as RoomApplicationsMap, [allRooms]);

  const value: JobRoomsContextValue = {
    rooms: filteredRooms,
    allRooms,
    filters,
    applicationsRegistry,
    updateFilters,
    applyToJob,
    postJobRoom,
    sendChatMessage,
    approveProposal,
    reviewProposal,
    respondToInvitation,
    updateProposalNote,
    fundMilestone,
    submitMilestoneWork,
    reviewMilestone,
    addRoomFile,
    openDispute,
    resolveDispute,
    addReview,
  };

  return <JobRoomsContext.Provider value={value}>{children}</JobRoomsContext.Provider>;
}

export function useJobRoomsContext() {
  const context = useContext(JobRoomsContext);
  if (!context) throw new Error("useJobRoomsContext must be used within a JobRoomsProvider.");
  return context;
}
