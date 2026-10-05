"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Grid,
  HStack,
  MoreMenu,
  Selector,
  Stack,
  Table,
  Text,
  TextInput,
  useToast,
  type TableColumn,
} from "sid-ui";
import { SettingsGroup } from "@/components/settings-group";
import { AuditTrailPanel } from "@/components/company/team/audit-trail-panel";
import { JobAccessPanel } from "@/components/company/team/job-access-panel";
import { RolePermissionMatrix } from "@/components/company/team/role-permission-matrix";
import { fetchTeam, inviteTeammate, removeTeammate, setTeammateRole } from "@/lib/company/api";
import {
  ROLE_META,
  canInviteWithRole,
  canPermission,
  canSetMemberRole,
  currentMemberRole,
  denialReason,
  editableRoleOptions,
  inviteRoleOptions,
  normalizeTeamRole,
  type TeamMember,
  type TeamRole,
} from "@/lib/rbac";

const AVATAR_SIZE = 36;
const ROLE_WIDTH = 200;
const INVITE_MIN_WIDTH = 200;

/** Members with editable roles, permission matrix, per-job access, and audit trail. */
export function TeamWorkspace({ actorRole = null }: { actorRole?: TeamRole | null }) {
  const toast = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("recruiter");

  useEffect(() => {
    let active = true;
    fetchTeam()
      .then((team) => {
        if (!active) return;
        setMembers(
          team.members.map((member) => ({ ...member, role: normalizeTeamRole(member.role) })),
        );
        setDomain(team.emailDomain);
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    return () => {
      active = false;
    };
  }, [toast]);

  // Prefer session hiringRole; fall back to the you-row on the team list.
  const actor = actorRole ?? currentMemberRole(members);
  const canInvite = canPermission(actor, "team.invite");
  const canManageRoles = canPermission(actor, "team.manage_roles");
  const canViewAudit = canPermission(actor, "audit.view");
  const canEditJobAccess =
    canPermission(actor, "jobs.edit") || canPermission(actor, "team.manage_roles");

  const inviteOptions = useMemo(() => inviteRoleOptions(actor), [actor]);
  const roleOptions = useMemo(() => editableRoleOptions(actor), [actor]);

  const suffix = domain ? `@${domain}` : "";
  const address = email.trim().toLowerCase();
  const wrongDomain = suffix.length > 0 && address.length > 0 && !address.endsWith(suffix);
  const exists = members.some((member) => member.email === address);
  const inviteCheck = canInviteWithRole(actor, role);

  const invite = () => {
    const check = canInviteWithRole(actor, role);
    if (!check.ok) {
      toast({ body: check.reason ?? "Cannot invite", type: "error" });
      return;
    }
    inviteTeammate(address, role)
      .then((team) => {
        setMembers(
          team.members.map((member) => ({ ...member, role: normalizeTeamRole(member.role) })),
        );
        setEmail("");
        toast({ body: `Invite saved for ${address}` });
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
  };

  const update = (member: TeamMember, nextRole: TeamRole) => {
    const check = canSetMemberRole(actor, member, nextRole);
    if (!check.ok) {
      toast({ body: check.reason ?? "Cannot change role", type: "error" });
      return;
    }
    setTeammateRole(member.id, nextRole)
      .then(() => {
        setMembers((current) =>
          current.map((row) => (row.id === member.id ? { ...row, role: nextRole } : row)),
        );
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
  };

  const remove = (member: TeamMember) => {
    if (!canManageRoles) {
      toast({ body: denialReason(actor, "team.manage_roles"), type: "error" });
      return;
    }
    removeTeammate(member.id)
      .then(() => {
        setMembers((current) => current.filter((item) => item.id !== member.id));
        toast({
          body: member.isPending ? `Invite to ${member.email} cancelled` : `${member.name} removed`,
        });
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
  };

  const columns: TableColumn<TeamMember>[] = [
    {
      key: "name",
      header: "Member",
      render: (row) => (
        <HStack gap={3} vAlign="center">
          <Avatar name={row.name} size={AVATAR_SIZE} tooltip={false} />
          <Stack gap={0}>
            <HStack gap={2} vAlign="center">
              <Text weight="medium">{row.isPending ? row.email : row.name}</Text>
              {row.isYou ? <Badge label="You" variant="blue" /> : null}
              {row.isPending ? <Badge label="Pending" variant="warning" /> : null}
            </HStack>
            <Text type="supporting" color="secondary">
              {row.isPending ? row.lastActive : row.email}
            </Text>
          </Stack>
        </HStack>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: ROLE_WIDTH,
      render: (row) =>
        row.role === "owner" || !canManageRoles ? (
          <Stack gap={0}>
            <Text weight="medium">{ROLE_META[row.role].label}</Text>
            <Text type="supporting" color="secondary">
              {ROLE_META[row.role].hint}
            </Text>
          </Stack>
        ) : (
          <Selector
            label={`Role for ${row.name}`}
            isLabelHidden
            size="sm"
            options={roleOptions}
            value={row.role === "viewer" ? "interviewer" : row.role}
            onChange={(value) => update(row, value as TeamRole)}
          />
        ),
    },
    {
      key: "lastActive",
      header: "Last active",
      render: (row) => (
        <Text type="supporting" color="secondary">
          {row.isPending ? "—" : row.lastActive}
        </Text>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (row) =>
        row.isYou || row.role === "owner" || !canManageRoles ? null : (
          <MoreMenu
            label={`Actions for ${row.name}`}
            size="sm"
            items={[
              ...(row.isPending
                ? [
                    {
                      label: "Resend invite",
                      onClick: () => toast({ body: `${row.email} is still pending` }),
                    },
                  ]
                : []),
              {
                label: row.isPending ? "Cancel invite" : "Remove from team",
                variant: "destructive",
                onClick: () => remove(row),
              },
            ]}
          />
        ),
    },
  ];

  return (
    <Stack gap={6}>
      {actor ? (
        <Banner
          status="info"
          title={`Signed in as ${ROLE_META[actor].label}`}
          description={ROLE_META[actor].description}
        />
      ) : null}

      <SettingsGroup
        title="Invite teammates"
        description={
          suffix
            ? `Anyone with a ${suffix} address. Pick a role — Hiring manager, Interviewer, and Finance are Einstein roles.`
            : "Anyone you invite. Add a website to limit this to your domain."
        }
      >
        {!canInvite ? (
          <Text type="supporting" color="secondary">
            {denialReason(actor, "team.invite")}
          </Text>
        ) : (
          <Grid columns={{ minWidth: INVITE_MIN_WIDTH, repeat: "fit" }} gap={3} align="end">
            <TextInput
              label="Work email"
              value={email}
              onChange={setEmail}
              placeholder={suffix ? `name${suffix}` : "name@company.com"}
              status={
                wrongDomain ? { type: "error", message: `Use a ${suffix} address.` } : undefined
              }
            />
            <Selector
              label="Role"
              options={inviteOptions}
              value={role}
              onChange={(value) => setRole(value as TeamRole)}
            />
            <Button
              label="Send invite"
              variant="primary"
              isDisabled={!address || wrongDomain || exists || !inviteCheck.ok}
              onClick={invite}
            />
          </Grid>
        )}
        {canInvite && inviteOptions.length > 0 ? (
          <Text type="supporting" color="secondary">
            {ROLE_META[role].description}
          </Text>
        ) : null}
      </SettingsGroup>

      <SettingsGroup
        title="Members"
        description={`${members.filter((member) => !member.isPending).length} people · ${members.filter((member) => member.isPending).length} pending`}
      >
        <Table
          caption="Team members"
          columns={columns}
          rows={members}
          rowKey={(row) => row.id}
          variant="plain"
        />
      </SettingsGroup>

      <SettingsGroup
        title="Permission matrix"
        description="What each role can do across jobs, applicants, interviews, offers, billing, and team."
      >
        <RolePermissionMatrix />
      </SettingsGroup>

      <SettingsGroup
        title="Per-job access"
        description="Optional overrides when someone should only act on specific reqs."
      >
        <JobAccessPanel members={members} canEdit={canEditJobAccess} />
      </SettingsGroup>

      <SettingsGroup
        title="Audit trail"
        description="Who changed roles, stages, offers, hires, billing, and job access."
      >
        <AuditTrailPanel canView={canViewAudit} />
      </SettingsGroup>
    </Stack>
  );
}
