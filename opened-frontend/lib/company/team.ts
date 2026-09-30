/** Hiring workspace — team members. Role contract lives in lib/rbac.ts (Layer F). */

export type { TeamRole, TeamMember, RoleMeta } from "@/lib/rbac";

export {
  ROLE_META,
  TEAM_ROLES,
  INVITABLE_ROLES,
  canPermission,
  currentMemberRole,
  normalizeTeamRole,
  denialReason,
  permissionsFor,
  effectiveTeamRole,
} from "@/lib/rbac";
