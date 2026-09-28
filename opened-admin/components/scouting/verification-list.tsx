import { Badge, EmptyState, List, ListItem, Text } from "@openseat/design-system";
import { LEVEL_BADGE, type ScoutSummary } from "@openseat/scout";
import { ageLabel } from "@/lib/format";
import { ROUTES } from "@/lib/nav";

/** Scouts waiting on an identity decision; each opens the scout. */
export function VerificationList({ rows }: { rows: ScoutSummary[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        isCompact
        title="No one is waiting"
        description="Identity requests show up here."
      />
    );
  }
  return (
    <List density="compact">
      {rows.map(({ profile }) => (
        <ListItem
          key={profile.user_id}
          href={ROUTES.scout(profile.user_id)}
          label={profile.legal_name || profile.name}
          description={`${profile.email} · ${profile.country ?? "—"}`}
          startContent={<Badge label={profile.level} variant={LEVEL_BADGE[profile.level]} />}
          endContent={
            <Text type="supporting" color="secondary">
              {ageLabel(profile.verification_updated_at)}
            </Text>
          }
        />
      ))}
    </List>
  );
}
