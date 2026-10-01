"use client";

import type { ReactNode } from "react";
import {
  Badge,
  Heading,
  HStack,
  List,
  ListItem,
  SectionCard,
  Stack,
  Text,
  Token,
} from "@joined/design-system";
import type { SearchJob } from "@/lib/search-job";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={3} as="section">
      <Heading level={3}>{title}</Heading>
      {children}
    </Stack>
  );
}

/** The listing copy Opened shows: about, what you'll do, what you'll need, benefits. */
export function ListingPreview({ job }: { job: SearchJob }) {
  return (
    <SectionCard
      title="Opened listing"
      description="This is the structured record job hunters read after analyze."
    >
      <Stack gap={6}>
        <Section title="Skills">
          {job.skills.length ? (
            <HStack gap={1.5} wrap="wrap">
              {job.skills.map((skill) => (
                <Badge key={skill} label={skill} variant="neutral" />
              ))}
            </HStack>
          ) : (
            <Text color="secondary">Required. Analyze generates them.</Text>
          )}
        </Section>
        <Section title="About the role">
          <Text display="block">{job.summary || "—"}</Text>
        </Section>
        <Section title="What you’ll do">
          {job.responsibilities.length ? (
            <List listStyle="disc">
              {job.responsibilities.map((item) => (
                <ListItem key={item} label={item} />
              ))}
            </List>
          ) : (
            <Text color="secondary">Analyze to fill this.</Text>
          )}
        </Section>
        <Section title="What you’ll need">
          {job.requirements.length ? (
            <List listStyle="disc">
              {job.requirements.map((item) => (
                <ListItem key={item} label={item} />
              ))}
            </List>
          ) : (
            <Text color="secondary">Analyze to fill this.</Text>
          )}
        </Section>
        {job.benefits.length ? (
          <Section title="Benefits">
            <HStack gap={2} wrap="wrap">
              {job.benefits.map((benefit) => (
                <Token key={benefit} label={benefit} />
              ))}
            </HStack>
          </Section>
        ) : null}
        {job.team ? (
          <Text type="supporting" color="secondary">
            Team: {job.team}
          </Text>
        ) : null}
      </Stack>
    </SectionCard>
  );
}
