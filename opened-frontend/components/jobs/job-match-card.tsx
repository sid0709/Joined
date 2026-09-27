import {
  Banner,
  Button,
  Card,
  Glyph,
  Grid,
  HStack,
  Heading,
  Icon,
  ProgressBar,
  Stack,
  Text,
  Token,
  icons,
  type IconColor,
} from "@openseat/design-system";
import { GOOD_MATCH, STRONG_MATCH, type JobMatch, type MatchLevel } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";
import { matchProgressVariant } from "./match-badge";

const CRITERIA_MIN_WIDTH = 200;
const CRITERIA_COLUMNS = 2;

const LEVEL_ICON: Record<MatchLevel, { icon: (typeof icons)["check"]; color: IconColor }> = {
  yes: { icon: icons.check, color: "success" },
  partial: { icon: icons.minus, color: "warning" },
  no: { icon: icons.close, color: "secondary" },
};

function headline(score: number) {
  if (score >= STRONG_MATCH) return "Strong match";
  if (score >= GOOD_MATCH) return "Good match";
  return score > 0 ? "Low match" : "Not a match yet";
}

/** Why this job scored what it did — every criterion and every skill, in the open. */
export function JobMatchCard({ match }: { match: JobMatch }) {
  return (
    <Card variant="muted" padding={5}>
      <Stack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={3}>
          <Stack gap={0.5}>
            <HStack gap={1.5} vAlign="center">
              <Icon icon={icons.sparkle} color="accent" size="sm" />
              <Heading level={3}>{headline(match.score)}</Heading>
            </HStack>
            <Text type="supporting" color="secondary" display="block">
              Scored against your target roles, skills, pay floor, and locations.
            </Text>
          </Stack>
          <Text type="display-3" hasTabularNumbers>
            {match.score}%
          </Text>
        </HStack>
        <ProgressBar
          label="Match score"
          isLabelHidden
          value={match.score}
          variant={matchProgressVariant(match.score)}
        />

        <Grid columns={{ minWidth: CRITERIA_MIN_WIDTH, max: CRITERIA_COLUMNS }} gap={3}>
          {match.criteria.map((criterion) => (
            <HStack key={criterion.id} gap={2} vAlign="start">
              <Icon
                icon={LEVEL_ICON[criterion.level].icon}
                color={LEVEL_ICON[criterion.level].color}
                size="sm"
              />
              <Stack gap={0}>
                <Text weight="medium">{criterion.label}</Text>
                <Text type="supporting" color="secondary">
                  {criterion.detail}
                </Text>
              </Stack>
            </HStack>
          ))}
        </Grid>

        <Stack gap={2}>
          <Text type="supporting" color="secondary">
            Skills they list
          </Text>
          <HStack gap={1.5} wrap="wrap">
            {match.matchedSkills.map((skill) => (
              <Token
                key={skill}
                label={skill}
                size="sm"
                color="green"
                icon={<Glyph name="check" />}
              />
            ))}
            {match.missingSkills.map((skill) => (
              <Token key={skill} label={skill} size="sm" />
            ))}
          </HStack>
        </Stack>

        {match.needsVisa ? (
          <Banner
            status="warning"
            title="This job doesn’t sponsor visas"
            description="Your profile says you need sponsorship."
          />
        ) : null}

        <HStack>
          <Button
            label="Improve my match"
            variant="ghost"
            size="sm"
            href={ROUTES.profile}
            icon={<Glyph name="edit" />}
          />
        </HStack>
      </Stack>
    </Card>
  );
}
