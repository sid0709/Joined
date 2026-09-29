const BASE = "/marketplace/client";

export const HUNTER_ROUTES = {
  dashboard: `${BASE}/dashboard`,
  tasks: `${BASE}/jobs`,
  newTask: `${BASE}/jobs/new`,
  task: (taskId: string) => `${BASE}/jobs/${taskId}`,
  pool: `${BASE}/pool`,
  bidders: `${BASE}/bidders`,
  interviews: `${BASE}/calendar`,
  monitoring: `${BASE}/work`,
  messages: `${BASE}/messages`,
  billing: `${BASE}/payments`,
  notifications: `${BASE}/notifications`,
  profile: `${BASE}/profile`,
} as const;
