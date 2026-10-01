"use client";

import { Badge, HStack, Stack, Table, Text, type TableColumn } from "@joined/design-system";
import {
  PERMISSION_META,
  ROLE_META,
  TEAM_ROLES,
  canPermission,
  type PermissionMeta,
  type TeamRole,
} from "@/lib/rbac";

const ROLE_COL_WIDTH = 88;
const DISPLAY_ROLES: TeamRole[] = TEAM_ROLES.filter((role) => role !== "viewer");

type MatrixRow = PermissionMeta & { id: string };

function mark(role: TeamRole, permission: PermissionMeta["id"]) {
  return canPermission(role, permission);
}

/** What each company role can do across jobs / applicants / interviews / offers / billing / team. */
export function RolePermissionMatrix() {
  const columns: TableColumn<MatrixRow>[] = [
    {
      key: "label",
      header: "Permission",
      render: (row) => (
        <Stack gap={0}>
          <Text weight="medium">{row.label}</Text>
          <Text type="supporting" color="secondary">
            {row.domain} · {row.description}
          </Text>
        </Stack>
      ),
    },
    ...DISPLAY_ROLES.map((role): TableColumn<MatrixRow> => ({
      key: role,
      header: ROLE_META[role].label,
      width: ROLE_COL_WIDTH,
      align: "center",
      render: (row) =>
        mark(role, row.id) ? (
          <Badge label="Yes" variant="success" />
        ) : (
          <Text type="supporting" color="secondary">
            —
          </Text>
        ),
    })),
  ];

  const rows: MatrixRow[] = PERMISSION_META.map((item) => ({ ...item }));

  return (
    <Stack gap={3}>
      <HStack gap={2} wrap="wrap">
        {DISPLAY_ROLES.map((role) => (
          <Badge key={role} label={ROLE_META[role].label} variant="blue" />
        ))}
      </HStack>
      <Table
        caption="Role permission matrix"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        variant="plain"
      />
      <Text type="supporting" color="secondary">
        Soft client matrix only. Einstein must enforce the same grants on every mutating API. Legacy
        Viewer maps to Interviewer.
      </Text>
    </Stack>
  );
}
