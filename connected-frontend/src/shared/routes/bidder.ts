const BASE = "/marketplace/candidate";

export const BIDDER_ROUTES = {
  dashboard: `${BASE}/dashboard`,
  board: "/marketplace/jobs",
  task: (taskId: string) => `/marketplace/jobs/${taskId}`,
  pipeline: `${BASE}/bids`,
  invitations: `${BASE}/invitations`,
  interviews: `${BASE}/calendar`,
  messages: "/marketplace/messages",
  thread: (engagementId: string) => `/marketplace/messages?thread=${engagementId}`,
  work: `${BASE}/work`,
  workDesk: (assignmentId: string) => `${BASE}/work?desk=${assignmentId}`,
  reviews: `${BASE}/feedback`,
  earnings: `${BASE}/earnings`,
  performance: `${BASE}/performance`,
  assessments: `${BASE}/tests`,
  notifications: `${BASE}/notifications`,
  profile: `${BASE}/profile`,
} as const;
