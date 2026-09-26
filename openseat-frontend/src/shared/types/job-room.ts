export type BudgetType = "Hourly" | "Fixed-Price";
export type ExperienceLevel = "Entry Level" | "Intermediate" | "Expert";
export type ProposalStatus = "Pending" | "In Discussion" | "Shortlisted" | "Invited" | "Rejected" | "Approved" | "Archived";
export type ProposalReviewAction = "shortlist" | "invite" | "reject" | "archive" | "restore";
export type MilestoneStatus = "Proposed" | "Funded" | "In Progress" | "In Review" | "Changes Requested" | "Approved" | "Paid";
export type WorkStatus = "Open" | "Reviewing" | "Awarded" | "In Progress" | "In Review" | "Completed" | "Disputed" | "Cancelled";
export type EscrowStatus = "Not funded" | "Funded" | "Partially released" | "Released" | "Refunded" | "On hold";

export interface ProposalMilestone {
  id: string;
  title: string;
  deliverable: string;
  amountText: string;
  dueDate: string;
}

export interface WorkExample {
  id: string;
  title: string;
  url: string;
  summary: string;
}

export interface ProposalDraft {
  candidateRate: string;
  estimatedTimelineText: string;
  availabilityText: string;
  coverLetterText: string;
  milestones: ProposalMilestone[];
  workExamples: WorkExample[];
}

export interface JobRoomRecord {
  id: string;
  title: string;
  sourceCompany?: string;
  sourceUrl?: string;
  applicationDeadline?: string;
  sourceJobStatus?: "Open" | "Closing soon" | "Closed";
  postedTimeText: string;
  isPaymentVerified: boolean;
  clientRating?: number;
  clientTotalSpentText: string;
  clientLocationCode: string;
  budgetType: BudgetType;
  rateOrBudgetRangeText: string;
  experienceLevelRequired: ExperienceLevel;
  durationEstimateText: string;
  weeklyCommitmentText: string;
  descriptionParagraph: string;
  skillsTags: string[];
  proposalsCountText: string;
  workflow?: JobRoomWorkflow;
}

export interface FilterState {
  searchQuery: string;
  experienceLevels: ExperienceLevel[];
  budgetTypes: BudgetType[];
}

export interface ProposalRecord extends ProposalDraft {
  id: string;
  candidateEmail?: string;
  candidateName: string;
  candidateTitle: string;
  identityVerified?: boolean;
  status: ProposalStatus;
  clientNote?: string;
}

export interface ChatMessage {
  senderRole: "Client" | "Candidate";
  text: string;
  timestamp: string;
}

export interface MilestoneRecord extends ProposalMilestone {
  status: MilestoneStatus;
  submittedAt?: string;
  approvedAt?: string;
  feedbackText?: string;
}

export interface RoomFileRecord {
  id: string;
  name: string;
  description?: string;
  uploadedByRole: "Client" | "Candidate";
  uploadedAt: string;
  sizeText: string;
}

export interface DeliveryRecord {
  id: string;
  milestoneId: string;
  milestoneTitle: string;
  summary: string;
  submittedAt: string;
  status: "Submitted" | "Changes Requested" | "Approved";
  fileIds: string[];
}

export interface RoomTrustRecord {
  paymentVerified: boolean;
  clientIdentityVerified: boolean;
  candidateIdentityVerified: boolean;
  escrowStatus: EscrowStatus;
  reviewEligible: boolean;
}

export interface RoomDisputeRecord {
  id: string;
  openedByRole: "Client" | "Candidate";
  reason: string;
  openedAt: string;
  status: "Open" | "Under Review" | "Resolved";
}

export interface RoomReviewRecord {
  id: string;
  authorRole: "Client" | "Candidate";
  rating: number;
  text: string;
  createdAt: string;
}

export interface JobRoomWorkflow {
  proposals: ProposalRecord[];
  chatHistory: { [candidateId: string]: ChatMessage[] };
  selectedCandidateId: string | null;
  shortlistIds: string[];
  invitedCandidateIds: string[];
  milestones: MilestoneRecord[];
  files: RoomFileRecord[];
  deliveryHistory: DeliveryRecord[];
  reviews: RoomReviewRecord[];
  trust: RoomTrustRecord;
  workStatus: WorkStatus;
  dispute?: RoomDisputeRecord;
}

export interface RoomApplicationsMap {
  [roomId: string]: JobRoomWorkflow;
}
