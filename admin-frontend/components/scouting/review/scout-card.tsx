import {
  Avatar,
  Badge,
  Button,
  HStack,
  MetadataList,
  MetadataListItem,
  SectionCard,
  Stack,
  Text,
} from "sid-ui";
import {
  LEVEL_BADGE,
  VERIFICATION,
  formatMoney,
  formatRate,
  type LevelRule,
  type ScoutSummary,
} from "@joined/scout";
import { formatCount } from "@/lib/format";
import { ROUTES } from "@/lib/nav";

const AVATAR = 40;

/** Who sent the job and how reliable their past work has been. */
export function ScoutCard({ summary, rule }: { summary: ScoutSummary; rule: LevelRule }) {
  const { profile, metrics, balance } = summary;
  const verification = VERIFICATION[profile.verification];
  return (
    <SectionCard
      title="Scout"
      action={
        <Button label="Profile" variant="ghost" size="sm" href={ROUTES.scout(profile.user_id)} />
      }
    >
      <HStack gap={3} vAlign="center">
        <Avatar name={profile.name} size={AVATAR} tooltip={false} />
        <Stack gap={0.5}>
          <Text weight="semibold">{profile.name}</Text>
          <Text type="supporting" color="secondary">
            {profile.email}
          </Text>
        </Stack>
      </HStack>
      <HStack gap={1.5} wrap="wrap">
        <Badge label={rule.label} variant={LEVEL_BADGE[profile.level]} />
        <Badge label={verification.label} variant={verification.badge} />
        {profile.level_pinned ? <Badge label="Level set by staff" variant="neutral" /> : null}
      </HStack>
      <MetadataList columns={2}>
        <MetadataListItem label="Approval rate">
          {formatRate(metrics.approval_rate)}
        </MetadataListItem>
        <MetadataListItem label="Submitted">{formatCount(metrics.submitted)}</MetadataListItem>
        <MetadataListItem label="Approved">{formatCount(metrics.approved)}</MetadataListItem>
        <MetadataListItem label="Rejected">{formatCount(metrics.rejected)}</MetadataListItem>
        <MetadataListItem label="Duplicate / expired">
          {formatRate(metrics.duplicate_expired_rate)}
        </MetadataListItem>
        <MetadataListItem label="Earned">{formatMoney(balance.lifetime)}</MetadataListItem>
      </MetadataList>
    </SectionCard>
  );
}
