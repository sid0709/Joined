/** Hiring workspace — team. */

export type TeamRole = "owner" | "admin" | "recruiter" | "viewer";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  lastActive: string;
  isYou?: boolean;
  isPending?: boolean;
};

export const ROLE_META: Record<TeamRole, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Everything, including billing and deleting the company." },
  admin: { label: "Admin", description: "Manage jobs, team, and settings. No billing." },
  recruiter: {
    label: "Recruiter",
    description: "Post jobs, review applicants, schedule interviews.",
  },
  viewer: { label: "Viewer", description: "Read-only access to jobs and applicants." },
};
