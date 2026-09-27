"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
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
} from "@openseat/design-system";
import { SettingsGroup } from "@/components/settings-group";
import { ROLE_META, TEAM, TEAM_EMAIL_DOMAIN, type TeamMember, type TeamRole } from "@/lib/company";

const AVATAR_SIZE = 36;
const ROLE_WIDTH = 160;
const INVITE_MIN_WIDTH = 200;
const ROLES = Object.keys(ROLE_META) as TeamRole[];
const INVITABLE = ROLES.filter((role) => role !== "owner").map((role) => ({
  value: role,
  label: ROLE_META[role].label,
}));
const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_META[role].label }));

/** Members with editable roles, a domain-checked invite form, and what each role can do. */
export function TeamWorkspace() {
  const toast = useToast();
  const [members, setMembers] = useState(TEAM);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("recruiter");

  const address = email.trim().toLowerCase();
  const wrongDomain = address.length > 0 && !address.endsWith(TEAM_EMAIL_DOMAIN);
  const exists = members.some((member) => member.email === address);

  const invite = () => {
    setMembers((current) => [
      ...current,
      {
        id: `t-${address}`,
        name: address,
        email: address,
        role,
        lastActive: "Invited just now",
        isPending: true,
      },
    ]);
    setEmail("");
    toast({ body: `Invite sent to ${address}` });
  };
  const update = (id: string, patch: Partial<TeamMember>) =>
    setMembers((current) =>
      current.map((member) => (member.id === id ? { ...member, ...patch } : member)),
    );
  const remove = (member: TeamMember) => {
    setMembers((current) => current.filter((item) => item.id !== member.id));
    toast({
      body: member.isPending ? `Invite to ${member.email} cancelled` : `${member.name} removed`,
    });
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
        row.role === "owner" ? (
          <Text weight="medium">{ROLE_META.owner.label}</Text>
        ) : (
          <Selector
            label={`Role for ${row.name}`}
            isLabelHidden
            size="sm"
            options={ROLE_OPTIONS.filter((option) => option.value !== "owner")}
            value={row.role}
            onChange={(value) => update(row.id, { role: value as TeamRole })}
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
        row.isYou || row.role === "owner" ? null : (
          <MoreMenu
            label={`Actions for ${row.name}`}
            size="sm"
            items={[
              ...(row.isPending
                ? [
                    {
                      label: "Resend invite",
                      onClick: () => toast({ body: `Invite resent to ${row.email}` }),
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
      <SettingsGroup
        title="Invite teammates"
        description={`Anyone with a ${TEAM_EMAIL_DOMAIN} address.`}
      >
        <Grid columns={{ minWidth: INVITE_MIN_WIDTH, repeat: "fit" }} gap={3} align="end">
          <TextInput
            label="Work email"
            value={email}
            onChange={setEmail}
            placeholder={`name${TEAM_EMAIL_DOMAIN}`}
            status={
              wrongDomain
                ? { type: "error", message: `Use a ${TEAM_EMAIL_DOMAIN} address.` }
                : undefined
            }
          />
          <Selector
            label="Role"
            options={INVITABLE}
            value={role}
            onChange={(value) => setRole(value as TeamRole)}
          />
          <Button
            label="Send invite"
            variant="primary"
            isDisabled={!address || wrongDomain || exists}
            onClick={invite}
          />
        </Grid>
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

      <SettingsGroup title="What each role can do">
        {ROLES.map((key) => (
          <HStack key={key} hAlign="between" vAlign="center" gap={3} wrap="wrap">
            <Text weight="semibold">{ROLE_META[key].label}</Text>
            <Text type="supporting" color="secondary">
              {ROLE_META[key].description}
            </Text>
          </HStack>
        ))}
      </SettingsGroup>
    </Stack>
  );
}
