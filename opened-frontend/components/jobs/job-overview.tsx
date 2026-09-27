import type { ReactNode } from "react";
import {
  Glyph,
  HStack,
  Heading,
  Icon,
  List,
  ListItem,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
  Token,
  icons,
} from "@openseat/design-system";
import {
  EMPLOYMENT_LABEL,
  SENIORITY_LABEL,
  SOURCE_LABEL,
  WORKPLACE_LABEL,
  formatPay,
  type Job,
} from "@/lib/jobs";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={3} as="section">
      <Heading level={3}>{title}</Heading>
      {children}
    </Stack>
  );
}

/** The job itself: key facts, the pitch, the work, the bar, and the perks. */
export function JobOverview({ job }: { job: Job }) {
  return (
    <Stack gap={6}>
      <MetadataList columns="multi">
        <MetadataListItem label="Pay" icon={<Glyph name="star" />}>
          {formatPay(job.pay)}
        </MetadataListItem>
        <MetadataListItem label="Workplace" icon={<Glyph name="home" />}>
          {WORKPLACE_LABEL[job.workplace]}
        </MetadataListItem>
        <MetadataListItem label="Job type" icon={<Glyph name="clock" />}>
          {EMPLOYMENT_LABEL[job.employment]}
        </MetadataListItem>
        <MetadataListItem label="Level" icon={<Glyph name="arrowUp" />}>
          {SENIORITY_LABEL[job.seniority]}
        </MetadataListItem>
        <MetadataListItem label="Team" icon={<Glyph name="users" />}>
          {job.team}
        </MetadataListItem>
        <MetadataListItem label="Source" icon={<Glyph name="link" />}>
          {SOURCE_LABEL[job.source]}
        </MetadataListItem>
      </MetadataList>

      <Section title="About the role">
        <Text display="block">{job.summary}</Text>
      </Section>

      <Section title="What you’ll do">
        <List listStyle="disc">
          {job.responsibilities.map((item) => (
            <ListItem key={item} label={item} />
          ))}
        </List>
      </Section>

      <Section title="What you’ll need">
        <List density="compact">
          {job.requirements.map((item) => (
            <ListItem
              key={item}
              label={item}
              startContent={<Icon icon={icons.check} color="accent" size="sm" />}
            />
          ))}
        </List>
      </Section>

      {job.benefits.length ? (
        <Section title="Benefits">
          <HStack gap={2} wrap="wrap">
            {job.benefits.map((benefit) => (
              <Token key={benefit} label={benefit} icon={<Glyph name="heart" />} />
            ))}
          </HStack>
        </Section>
      ) : null}
    </Stack>
  );
}
