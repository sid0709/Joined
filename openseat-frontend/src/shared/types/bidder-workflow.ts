export type BidderTaskKind = "Permanent contact" | "One-time package";
export type BidderTaskStatus = "Open" | "Interest sent" | "Connected" | "Active";
export type BidderLinkStatus = "Assigned" | "In progress" | "Submitted" | "QA passed" | "Needs fix";

export interface BidderTaskPackage {
  id: string;
  name: string;
  ats: string;
  linkCount: number;
  ratePerLink: string;
  difficulty: "Easy" | "Standard" | "Advanced";
}

export interface BidderTask {
  id: string;
  ownerName: string;
  ownerInitials: string;
  title: string;
  kind: BidderTaskKind;
  status: BidderTaskStatus;
  description: string;
  postedAt: string;
  availability: string;
  payRange: string;
  dailyTarget: string;
  packages: BidderTaskPackage[];
  requirements: string[];
  qualityExpectation: string;
}

export interface BidderAssignedLink {
  id: string;
  company: string;
  title: string;
  ats: string;
  deadline: string;
  status: BidderLinkStatus;
  feedback?: string;
}

export interface BidderAssignment {
  id: string;
  taskId: string;
  taskTitle: string;
  ownerName: string;
  packageName: string;
  ratePerLink: string;
  assignedDate: string;
  dailyTarget: number;
  links: BidderAssignedLink[];
  totalEarned: string;
  pendingEarned: string;
}

export interface BidderConversation {
  id: string;
  taskId: string;
  taskTitle: string;
  ownerName: string;
  ownerInitials: string;
  unread: number;
  messages: { id: string; sender: "bidder" | "jobhunter"; body: string; time: string }[];
}
