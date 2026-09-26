export type UserRole = "Candidate" | "Client" | null;

export interface RegisteredUser {
  email: string;
  passwordText: string;
  fullName: string;
  role: UserRole;
}

export interface AccountUpdate {
  fullName: string;
  email: string;
}

export interface CandidateProfile {
  title: string;
  hourlyRate: string;
  bio: string;
  skills: string[];
  specialty: string;
  yearsExperience: string;
  availability: string;
  timezone: string;
  performanceScore: string;
  schedulingReliability: string;
  workExamples: string[];
  verificationStatus: "Not started" | "In review" | "Verified";
}

export interface ClientProfile {
  organizationName: string;
  organizationType: string;
  industry: string;
  location: string;
  description: string;
  hiringNeeds: string;
  evaluationApproach: string;
  paymentStatus: "Not verified" | "Verified";
  identityStatus: "Not verified" | "Verified";
}
