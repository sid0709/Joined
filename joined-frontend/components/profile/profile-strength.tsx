import { Card, HStack, Heading, Glyph, ProgressBar, Stack, Text } from "sid-ui";
import { strengthPercent, type StrengthStep } from "@/lib/profile";

const STRONG_THRESHOLD = 80;

/** How complete the profile is, and the next things to do. */
export function ProfileStrength({ steps }: { steps: StrengthStep[] }) {
  const percent = strengthPercent(steps);
  const remaining = steps.filter((step) => !step.done);

  return (
    <Card padding={6}>
      <Stack gap={4}>
        <Stack gap={1}>
          <Text type="supporting" color="secondary" display="block">
            Profile strength
          </Text>
          <HStack gap={2} vAlign="end">
            <Heading level={2} type="display-3">
              {`${percent}%`}
            </Heading>
            <Text color="secondary">
              {percent >= STRONG_THRESHOLD ? "Strong" : "Getting there"}
            </Text>
          </HStack>
        </Stack>
        <ProgressBar
          label="Profile strength"
          isLabelHidden
          value={percent}
          variant={percent >= STRONG_THRESHOLD ? "success" : "accent"}
        />
        <Text type="supporting" color="secondary" display="block">
          Complete profiles get up to 3× more recruiter views.
        </Text>
        <Stack gap={2}>
          {remaining.map((step) => (
            <HStack key={step.id} gap={2} vAlign="center">
              <Text color="secondary">
                <Glyph name="plus" />
              </Text>
              <Text>{step.label}</Text>
            </HStack>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}
