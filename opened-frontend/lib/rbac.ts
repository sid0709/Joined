/**
 * Layer F — Company team RBAC (scaffold) shapes.
 *
 * Einstein contract (persist + return these fields; UI scaffolds against them):
 *
 * GET /v1/company/team
 *   members[].role: TeamRole
 *   Legacy "viewer" still accepted on read; normalize via normalizeTeamRole().
 *
 * POST /v1/company/team
 *   body: { email: string; role: TeamRole }
 *   role must be invitabile (never owner). Reject 403 when actor lacks team.invite.
 *   Reject 400 when role is owner or unknown.
 *
 * PATCH /v1/company/team/:memberId
 *   body: { role: TeamRole }
 *   Never change the owner row via this path (use transfer). Only owner may
 *   grant/revoke admin. Reject 403 when actor lacks team.manage_roles.
 *
 * DELETE /v1/company/team/:memberId
 *   Reject removing owner. Require team.manage_roles.
 *
 * GET /v1/company/team/audit?cursor=&limit=
 *   response: { events: AuditEvent[]; nextCursor?: string }
 *   Append-only. Cover role changes, stage moves, offer status, hire, billing,
 *   invites, and job-access edits.
 *
 * GET /v1/company/jobs/:id/access
 *   response: { assignments: JobAccessAssignment[] }
 *
 * PUT /v1/company/jobs/:id/access
 *   body: { assignments: JobAccessAssignment[] }
 *   Per-job overrides on top of company role. Empty permissions = inherit role.
 *   Require jobs.edit (or team.manage_roles). Reject 403 otherwise.
 *
 * Enforcement: Einstein MUST enforce every sensitive mutation server-side.
 * Frontend gates are soft UX only — see canPermission() TODOs at call sites.
 *
 * Migration (legacy API → Einstein TeamRole):
 *   owner            → owner
 *   admin            → admin
 *   recruiter        → recruiter
 *   viewer           → interviewer  (read + score; no post / hire / billing)
 * New Einstein roles (not yet in opened-backend validHiringRole):
 *   hiring_manager, interviewer, finance
 * Until Einstein accepts them, POST/PATCH may 400 — UI still offers them and
 * soft-fails with a toast; do not invent a parallel backend enum here.
 *
 * Out of scope: SSO, analytics (G), Scoutwell, DocuSign, staff admin.
 */

/** Company hiring roles — owner is creator-only; never inviteable. */
export const TEAM_ROLES = [
  "owner",
  "admin",
  "recruiter",
  "hiring_manager",
  "interviewer",
  "finance",
  /** @deprecated Legacy read-only; normalize to interviewer. */
  "viewer",
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

/** Roles Einstein should accept on invite / role change (never owner). */
export const INVITABLE_ROLES: readonly TeamRole[] = [
  "admin",
  "recruiter",
  "hiring_manager",
  "interviewer",
  "finance",
];

/** Roles the current opened-backend validHiringRole accepts today. */
export const LEGACY_API_ROLES: readonly TeamRole[] = ["admin", "recruiter", "viewer"];

export type Permission =
  | "jobs.view"
  | "jobs.edit"
  | "jobs.publish"
  | "applicants.view"
  | "applicants.move"
  | "interviews.schedule"
  | "interviews.score"
  | "offers.draft"
  | "offers.send"
  | "offers.approve"
  | "offers.hire"
  | "billing.view"
  | "billing.purchase"
  | "team.invite"
  | "team.manage_roles"
  | "audit.view";

/** Matrix domains shown in Team settings. */
export const PERMISSION_DOMAINS = [
  "jobs",
  "applicants",
  "interviews",
  "offers",
  "billing",
  "team",
] as const;

export type PermissionDomain = (typeof PERMISSION_DOMAINS)[number];

export type PermissionMeta = {
  id: Permission;
  domain: PermissionDomain;
  label: string;
  description: string;
};

export const PERMISSION_META: PermissionMeta[] = [
  {
    id: "jobs.view",
    domain: "jobs",
    label: "View jobs",
    description: "See job list and details.",
  },
  {
    id: "jobs.edit",
    domain: "jobs",
    label: "Edit jobs",
    description: "Draft and update postings, pipeline, templates.",
  },
  {
    id: "jobs.publish",
    domain: "jobs",
    label: "Publish jobs",
    description: "Open or close a job on the market.",
  },
  {
    id: "applicants.view",
    domain: "applicants",
    label: "View applicants",
    description: "See pipeline cards and profiles.",
  },
  {
    id: "applicants.move",
    domain: "applicants",
    label: "Move stages",
    description: "Advance or reject candidates.",
  },
  {
    id: "interviews.schedule",
    domain: "interviews",
    label: "Schedule interviews",
    description: "Book rounds and share self-schedule links.",
  },
  {
    id: "interviews.score",
    domain: "interviews",
    label: "Submit scorecards",
    description: "Leave feedback after a round.",
  },
  {
    id: "offers.draft",
    domain: "offers",
    label: "Draft offers",
    description: "Edit comp and letter details.",
  },
  {
    id: "offers.send",
    domain: "offers",
    label: "Send offers",
    description: "Mark sent / create e-sign link.",
  },
  {
    id: "offers.approve",
    domain: "offers",
    label: "Approve offers",
    description: "Internal approve or reject a package.",
  },
  {
    id: "offers.hire",
    domain: "offers",
    label: "Mark hired",
    description: "Move to Hired and hand off packet.",
  },
  {
    id: "billing.view",
    domain: "billing",
    label: "View billing",
    description: "See balance, charges, purchases.",
  },
  {
    id: "billing.purchase",
    domain: "billing",
    label: "Add balance",
    description: "Credit prepaid interview balance.",
  },
  {
    id: "team.invite",
    domain: "team",
    label: "Invite teammates",
    description: "Send domain-checked invites.",
  },
  {
    id: "team.manage_roles",
    domain: "team",
    label: "Change roles",
    description: "Edit member roles and remove people.",
  },
  {
    id: "audit.view",
    domain: "team",
    label: "View audit trail",
    description: "Who changed roles, stages, offers.",
  },
];

const ALL: Permission[] = PERMISSION_META.map((item) => item.id);

const ROLE_PERMISSIONS: Record<TeamRole, readonly Permission[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== "billing.purchase"),
  recruiter: [
    "jobs.view",
    "jobs.edit",
    "jobs.publish",
    "applicants.view",
    "applicants.move",
    "interviews.schedule",
    "interviews.score",
    "offers.draft",
    "offers.send",
    "offers.hire",
  ],
  hiring_manager: [
    "jobs.view",
    "jobs.edit",
    "applicants.view",
    "applicants.move",
    "interviews.schedule",
    "interviews.score",
    "offers.draft",
    "offers.approve",
  ],
  interviewer: ["jobs.view", "applicants.view", "interviews.score"],
  finance: ["jobs.view", "billing.view", "billing.purchase", "offers.approve", "audit.view"],
  /** Legacy — same as interviewer until Einstein migrates rows. */
  viewer: ["jobs.view", "applicants.view"],
};

export type RoleMeta = {
  label: string;
  description: string;
  /** Short picker hint under the label. */
  hint: string;
  /** Hide from invite picker (owner, or deprecated viewer). */
  inviteable: boolean;
};

export const ROLE_META: Record<TeamRole, RoleMeta> = {
  owner: {
    label: "Owner",
    description: "Everything, including billing and deleting the company.",
    hint: "Creator only",
    inviteable: false,
  },
  admin: {
    label: "Admin",
    description: "Manage jobs, team, and settings. View billing; no purchases.",
    hint: "Team + settings",
    inviteable: true,
  },
  recruiter: {
    label: "Recruiter",
    description: "Post jobs, move applicants, schedule, send offers, hire.",
    hint: "Full hiring loop",
    inviteable: true,
  },
  hiring_manager: {
    label: "Hiring manager",
    description: "Own the req: edit job, move pipeline, draft/approve offers.",
    hint: "HM on a req",
    inviteable: true,
  },
  interviewer: {
    label: "Interviewer",
    description: "See assigned candidates and submit scorecards.",
    hint: "Score only",
    inviteable: true,
  },
  finance: {
    label: "Finance",
    description: "Billing balance and offer-package approvals. No pipeline edits.",
    hint: "Money + approve",
    inviteable: true,
  },
  viewer: {
    label: "Viewer (legacy)",
    description: "Read-only. Prefer Interviewer for new invites.",
    hint: "Deprecated",
    inviteable: false,
  },
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  lastActive: string;
  isYou?: boolean;
  isPending?: boolean;
};

/** Per-job override on top of company role. Empty permissions = inherit. */
export type JobAccessAssignment = {
  memberId: string;
  /** Optional tighter/looser grant for this job only. */
  permissions?: Permission[];
  /** Optional display role label override for this job. */
  roleHint?: TeamRole;
};

export type JobAccessDocument = {
  jobId: string;
  assignments: JobAccessAssignment[];
};

export type AuditAction =
  | "role.changed"
  | "member.invited"
  | "member.removed"
  | "stage.moved"
  | "offer.updated"
  | "offer.sent"
  | "offer.approved"
  | "hire.marked"
  | "billing.purchased"
  | "job_access.updated";

export type AuditSubjectType = "member" | "applicant" | "offer" | "job" | "billing" | "team";

/** Append-only audit row — Einstein GET /team/audit. */
export type AuditEvent = {
  id: string;
  at: string;
  actorId: string;
  actorName?: string;
  action: AuditAction;
  subjectType: AuditSubjectType;
  subjectId: string;
  subjectLabel?: string;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

export type AuditListResponse = {
  events: AuditEvent[];
  nextCursor?: string;
};

/** Map legacy / unknown API strings onto TeamRole. */
export function normalizeTeamRole(raw: string | null | undefined): TeamRole {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "hm" || value === "hiring-manager" || value === "hiring_manager") {
    return "hiring_manager";
  }
  if ((TEAM_ROLES as readonly string[]).includes(value)) {
    return value as TeamRole;
  }
  return "recruiter";
}

/** Effective role for matrix checks — viewer collapses to interviewer. */
export function effectiveTeamRole(role: TeamRole): TeamRole {
  return role === "viewer" ? "interviewer" : role;
}

export function canPermission(role: TeamRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const effective = effectiveTeamRole(role);
  return ROLE_PERMISSIONS[effective].includes(permission);
}

export function permissionsFor(role: TeamRole): readonly Permission[] {
  return ROLE_PERMISSIONS[effectiveTeamRole(role)];
}

export function roleHasDomainAccess(role: TeamRole, domain: PermissionDomain): boolean {
  return permissionsFor(role).some((permission) => permission.startsWith(`${domain}.`));
}

/** You-row on the team list, when present. */
export function currentMemberRole(members: TeamMember[]): TeamRole | null {
  const you = members.find((member) => member.isYou);
  return you ? normalizeTeamRole(you.role) : null;
}

export function inviteRoleOptions(actor: TeamRole | null): { value: TeamRole; label: string }[] {
  const canInviteAdmin = actor === "owner";
  return INVITABLE_ROLES.filter((role) => {
    if (role === "admin" && !canInviteAdmin) return false;
    return ROLE_META[role].inviteable;
  }).map((role) => ({
    value: role,
    label: `${ROLE_META[role].label} — ${ROLE_META[role].hint}`,
  }));
}

export function editableRoleOptions(actor: TeamRole | null): { value: TeamRole; label: string }[] {
  return inviteRoleOptions(actor);
}

export function canInviteWithRole(
  actor: TeamRole | null,
  role: TeamRole,
): { ok: boolean; reason?: string } {
  if (!actor || !canPermission(actor, "team.invite")) {
    return { ok: false, reason: "Your role cannot invite teammates." };
  }
  if (role === "owner") {
    return { ok: false, reason: "Owner is transferred, not invited." };
  }
  if (role === "viewer") {
    return { ok: false, reason: "Viewer is legacy — invite as Interviewer instead." };
  }
  if (role === "admin" && actor !== "owner") {
    return { ok: false, reason: "Only the owner can invite admins." };
  }
  if (!(INVITABLE_ROLES as readonly string[]).includes(role)) {
    return { ok: false, reason: "That role cannot be invited." };
  }
  return { ok: true };
}

export function canSetMemberRole(
  actor: TeamRole | null,
  target: TeamMember,
  next: TeamRole,
): { ok: boolean; reason?: string } {
  if (!actor || !canPermission(actor, "team.manage_roles")) {
    return { ok: false, reason: "Your role cannot change teammate roles." };
  }
  if (target.role === "owner" || target.isYou) {
    return { ok: false, reason: "Owner role stays on the creator." };
  }
  if (next === "owner") {
    return { ok: false, reason: "Use ownership transfer instead." };
  }
  if (next === "admin" && actor !== "owner") {
    return { ok: false, reason: "Only the owner can grant admin." };
  }
  if (target.role === "admin" && actor !== "owner") {
    return { ok: false, reason: "Only the owner can change an admin." };
  }
  return { ok: true };
}

/** Soft reason string for disabled CTAs. */
export function denialReason(role: TeamRole | null | undefined, permission: Permission): string {
  if (!role) return "Sign in as a team member to continue.";
  if (canPermission(role, permission)) return "";
  return `Your role (${ROLE_META[effectiveTeamRole(role)].label}) cannot ${PERMISSION_META.find((item) => item.id === permission)?.label.toLowerCase() ?? permission}.`;
}

/** Merge company role permissions with an optional per-job override. */
export function effectiveJobPermissions(
  role: TeamRole,
  assignment?: JobAccessAssignment | null,
): Permission[] {
  if (assignment?.permissions && assignment.permissions.length > 0) {
    return [...assignment.permissions];
  }
  return [...permissionsFor(role)];
}

export function canOnJob(
  role: TeamRole | null | undefined,
  permission: Permission,
  assignment?: JobAccessAssignment | null,
): boolean {
  if (!role) return false;
  return effectiveJobPermissions(role, assignment).includes(permission);
}

/** Map Einstein role → legacy API role when backend still validates the old enum. */
export function toLegacyApiRole(role: TeamRole): TeamRole {
  switch (effectiveTeamRole(role)) {
    case "owner":
      return "owner";
    case "admin":
      return "admin";
    case "finance":
      return "admin";
    case "hiring_manager":
      return "recruiter";
    case "interviewer":
      return "viewer";
    case "recruiter":
      return "recruiter";
    default:
      return "viewer";
  }
}

export function hydrateAuditEvent(raw: Partial<AuditEvent> & { id?: string }): AuditEvent {
  return {
    id: String(raw.id ?? `aud-${Date.now()}`),
    at: String(raw.at ?? new Date().toISOString()),
    actorId: String(raw.actorId ?? ""),
    actorName: raw.actorName ? String(raw.actorName) : undefined,
    action: (raw.action as AuditAction) || "role.changed",
    subjectType: (raw.subjectType as AuditSubjectType) || "team",
    subjectId: String(raw.subjectId ?? ""),
    subjectLabel: raw.subjectLabel ? String(raw.subjectLabel) : undefined,
    summary: String(raw.summary ?? "Change recorded"),
    before: raw.before,
    after: raw.after,
  };
}

export function hydrateJobAccess(
  jobId: string,
  raw: { assignments?: JobAccessAssignment[] } | null | undefined,
): JobAccessDocument {
  const assignments = Array.isArray(raw?.assignments)
    ? raw!.assignments.map((item) => ({
        memberId: String(item.memberId),
        permissions: Array.isArray(item.permissions)
          ? item.permissions.filter((permission): permission is Permission =>
              ALL.includes(permission as Permission),
            )
          : undefined,
        roleHint: item.roleHint ? normalizeTeamRole(item.roleHint) : undefined,
      }))
    : [];
  return { jobId, assignments };
}
