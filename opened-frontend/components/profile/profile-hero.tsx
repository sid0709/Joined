import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  HStack,
  Heading,
  Glyph,
  Grid,
  Stack,
  Text,
} from "@openseat/design-system";
import {
  NOTICE_OPTIONS,
  WORKPLACE_OPTIONS,
  formatSalary,
  optionLabel,
  type Profile,
} from "@/lib/profile";

const AVATAR_SIZE = 96;
const FACT_MIN_WIDTH = 180;
const FACT_MAX_COLUMNS = 4;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={1}>
      <Text type="supporting" color="secondary" display="block">
        {label}
      </Text>
      <Text weight="medium" display="block">
        {value}
      </Text>
    </Stack>
  );
}

/** Identity header: who you are, how you’re doing, and what you’re looking for. */
export function ProfileHero({ profile }: { profile: Profile }) {
  return (
    <Card padding={6} elevation="low">
      <Stack gap={6}>
        <HStack hAlign="between" vAlign="start" gap={5} wrap="wrap">
          <HStack gap={5} vAlign="center" wrap="wrap">
            <Avatar name={profile.name} size={AVATAR_SIZE} tooltip={false} />
            <Stack gap={2}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Heading level={1}>{profile.name}</Heading>
                <Badge label="Verified" variant="info" icon={<Glyph name="check" />} />
              </HStack>
              <Text type="large" color="secondary" display="block">
                {profile.headline}
              </Text>
              <HStack gap={3} vAlign="center" wrap="wrap">
                <Badge label={profile.status.label} variant={profile.status.variant} />
                <Text type="supporting" color="secondary">
                  {profile.location}
                </Text>
                <Text type="supporting" color="secondary">
                  {profile.memberSince}
                </Text>
              </HStack>
            </Stack>
          </HStack>
          <HStack gap={2} wrap="wrap">
            <Button label="Share" variant="ghost" icon={<Glyph name="share" />} />
            <Button label="Preview as recruiter" variant="secondary" icon={<Glyph name="eye" />} />
          </HStack>
        </HStack>

        <Divider />

        <Grid columns={{ minWidth: FACT_MIN_WIDTH, max: FACT_MAX_COLUMNS }} gap={5}>
          <Fact label="Target roles" value={profile.targetRoles.join(", ")} />
          <Fact label="Workplace" value={optionLabel(WORKPLACE_OPTIONS, profile.workplace)} />
          <Fact
            label="Salary floor"
            value={`${formatSalary(profile.salaryFloor, profile.currency)} / yr`}
          />
          <Fact
            label="Available to start"
            value={optionLabel(NOTICE_OPTIONS, profile.noticePeriod)}
          />
        </Grid>
      </Stack>
    </Card>
  );
}
