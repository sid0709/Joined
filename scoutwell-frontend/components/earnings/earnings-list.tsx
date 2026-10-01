import { EmptyState, Glyph, List, ListItem, Stack, Text } from "@joined/design-system";
import type { GlyphName } from "@joined/design-system";
import { REWARD_TYPE, formatMoney, type Earning, type RewardType } from "@joined/scout";
import { EarningStatusBadge } from "@/components/status-badge";
import { formatDay } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";

const REWARD_ICON: Record<RewardType, GlyphName> = {
  approval: "check",
  interview: "chat",
  hire: "users",
  conversion: "star",
};

function detail(row: Earning) {
  const what = row.job_title ? `${row.job_title} · ${row.company_name ?? ""}` : row.description;
  return row.status === "held" ? `${what} · until ${formatDay(row.hold_until)}` : what;
}

/** Reward lines, newest first; a line that came from a job opens that submission. */
export function EarningsList({ rows }: { rows: Earning[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        isCompact
        title="No rewards yet"
        description="Approvals, settled interviews, and hires on your jobs show up here."
      />
    );
  }
  return (
    <List hasDividers>
      {rows.map((row) => (
        <ListItem
          key={row.id}
          label={REWARD_TYPE[row.type].label}
          description={detail(row)}
          startContent={<Glyph name={REWARD_ICON[row.type]} />}
          href={row.submission_id ? ROUTES.submission(row.submission_id) : undefined}
          endContent={
            <Stack gap={1} hAlign="end">
              <Text
                weight="semibold"
                hasTabularNumbers
                color={row.status === "clawed_back" ? "secondary" : "primary"}
              >
                {formatMoney(row.amount)}
              </Text>
              <EarningStatusBadge status={row.status} />
            </Stack>
          }
        />
      ))}
    </List>
  );
}
