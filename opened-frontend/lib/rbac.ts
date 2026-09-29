/**
 * Layer F — Company team RBAC.
 *
 * Soft client gates only. Einstein enforces the same matrix server-side (403 /
 * 400). Honor session company.hiringRole via sessionHiringRole() in access.ts;
 * creator acts as owner.
 *
 * GET /v1/company/team — members[].role: TeamRole; legacy viewer normalizes.
 * POST /v1/company/team — { email, role }; never owner; 403 without team.invite;
 *   400 for owner / viewer / unknown. Owner-only admin invite.
 * PATCH /v1/company/team/:memberId — { role }; owner-only admin grant/revoke;
 *   403 without team.manage_roles.
 * DELETE /v1/company/team/:memberId — no owner remove; team.manage_roles.
 * GET /v1/company/team/audit?cursor=&limit= — { events, nextCursor? }; audit.view.
 * GET|PUT /v1/company/jobs/:id/access — { assignments }; empty permissions inherit;
 *   PUT needs jobs.edit | team.manage_roles.
 *
 * Roles: owner (creator), admin, recruiter, hiring_manager, interviewer, finance;
 *   legacy viewer → interviewer perms via effectiveTeamRole().
 * Billing: finance can purchase; admin cannot (billing.view only).
 * Analytics (G): GET /v1/company/analytics requires analytics.view (403 otherwise).
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

/** @deprecated Einstein accepts the full TeamRole invite set; kept for older clients. */
export const LEGACY_API_ROLES: readonly TeamRole[] = [
  "admin",
  "recruiter",
  "hiring_manager",
  "interviewer",
  "finance",
  "viewer",
];

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
  | "audit.view"
  | "analytics.view";

/** Matrix domains shown in Team settings. */
export const PERMISSION_DOMAINS = [
  "jobs",
  "applicants",
  "interviews",
  "offers",
  "billing",
  "team",
  "analytics",
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
  {
    id: "analytics.view",
    domain: "analytics",
    label: "View analytics",
    description: "Funnel, source mix, time-in-stage, attendance.",
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
    "analytics.view",
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
    "analytics.view",
  ],
  interviewer: ["jobs.view", "applicants.view", "interviews.score"],
  finance: [
    "jobs.view",
    "billing.view",
    "billing.purchase",
    "offers.approve",
    "audit.view",
    "analytics.view",
  ],
  /** Legacy — effectiveTeamRole maps viewer → interviewer before checks. */
  viewer: ["jobs.view", "applicants.view", "interviews.score"],
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

/**
 * @deprecated Einstein accepts hiring_manager / interviewer / finance directly.
 * Identity map kept so older call sites do not remap away from live roles.
 */
export function toLegacyApiRole(role: TeamRole): TeamRole {
  return effectiveTeamRole(role);
}

export function hydrateAuditEvent(
  raw: Partial<Omit<AuditEvent, "at">> & { id?: string; at?: string | Date },
): AuditEvent {
  const atRaw = raw.at;
  let at = new Date().toISOString();
  if (typeof atRaw === "string" && atRaw.trim()) {
    at = atRaw;
  } else if (atRaw instanceof Date && !Number.isNaN(atRaw.getTime())) {
    at = atRaw.toISOString();
  }
  return {
    id: String(raw.id ?? `aud-${Date.now()}`),
    at,
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
