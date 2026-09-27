/** Hiring workspace — team. Sample data until the API lands. */

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

export const TEAM: TeamMember[] = [
  {
    id: "t-1",
    name: "Jordan Avery",
    email: "jordan@northwind.example",
    role: "owner",
    lastActive: "Active now",
    isYou: true,
  },
  {
    id: "t-2",
    name: "Priya Shah",
    email: "priya@northwind.example",
    role: "admin",
    lastActive: "2 hours ago",
  },
  {
    id: "t-3",
    name: "Marcus Lee",
    email: "marcus@northwind.example",
    role: "recruiter",
    lastActive: "Yesterday",
  },
  {
    id: "t-4",
    name: "Grace Kim",
    email: "grace@northwind.example",
    role: "recruiter",
    lastActive: "3 days ago",
  },
  {
    id: "t-5",
    name: "Elena Novak",
    email: "elena@northwind.example",
    role: "viewer",
    lastActive: "Last week",
  },
  {
    id: "t-6",
    name: "sam@northwind.example",
    email: "sam@northwind.example",
    role: "recruiter",
    lastActive: "Invited 2 days ago",
    isPending: true,
  },
];

/** Only this domain can be invited. */
export const TEAM_EMAIL_DOMAIN = "@northwind.example";
