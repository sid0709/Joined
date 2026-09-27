import {
  Avatar,
  Badge,
  Button,
  Divider,
  HStack,
  Heading,
  Glyph,
  Stack,
  Text,
} from "@openseat/design-system";
import type { ExperienceItem } from "@/lib/profile";
import { SectionCard } from "@/components/section-card";

const LOGO_SIZE = 48;

function ExperienceRow({ item }: { item: ExperienceItem }) {
  return (
    <HStack gap={4} vAlign="start">
      <Avatar name={item.company} size={LOGO_SIZE} shape="rounded" tooltip={false} />
      <Stack gap={1}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Heading level={3}>{item.role}</Heading>
          {item.current ? <Badge label="Current" variant="blue" /> : null}
        </HStack>
        <Text color="secondary" display="block">
          {item.company} · {item.period}
        </Text>
        <Text display="block">{item.summary}</Text>
      </Stack>
    </HStack>
  );
}

/** Work history, newest first. */
export function ProfileExperience({ items }: { items: ExperienceItem[] }) {
  return (
    <SectionCard
      title="Experience"
      description="Parsed from your default resume. Edit anything that looks off."
      action={
        <Button label="Add role" variant="secondary" size="sm" icon={<Glyph name="plus" />} />
      }
    >
      <Stack gap={5}>
        {items.map((item, index) => (
          <Stack key={item.id} gap={5}>
            {index > 0 ? <Divider /> : null}
            <ExperienceRow item={item} />
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  );
}
