export interface ScoutProfile {
  user_id: string;
  name: string;
  email: string;
  level: string;
  level_pinned: boolean;
  terms_accepted_at: string | null;
  verification: string;
  verification_note?: string;
  legal_name?: string;
  country?: string;
  notify_decisions: boolean;
  notify_rewards: boolean;
  verification_tier: number;
  created_at: string;
  updated_at: string;
  verification_updated_at?: string;
}

export interface ApiFieldError {
  field: string;
  detail: string;
}

export interface ApiError {
  error: string;
  message?: string;
  detail?: string;
  title?: string;
  errors?: ApiFieldError[];
}

export interface ExtensionSubmissionInput {
  title: string;
  company: string;
  location: string;
  apply_url: string;
  description: string;
  board?: string;
}

export interface ExtensionSubmission {
  id: string;
}

export interface ExtensionSubmitResult {
  submission: ExtensionSubmission;
  replayed: boolean;
}

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; profile: ScoutProfile }
  | { status: "error"; error: string };
