"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  HStack,
  Heading,
  Link,
  List,
  ListItem,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
} from "@openseat/design-system";
import { SOURCE_LABEL, WORKPLACE_LABEL, type Job } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";

const MATCH_THRESHOLD = 80;

export function JobDetail({
  job,
  saved = false,
  onToggleSave,
  showPageLink = false,
}: {
  job: Job;
  saved?: boolean;
  onToggleSave?: () => void;
  showPageLink?: boolean;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [localSaved, setLocalSaved] = useState(saved);
  const isSaved = onToggleSave ? saved : localSaved;
  const toggleSave = onToggleSave ?? (() => setLocalSaved((value) => !value));
  const direct = job.source === "direct";

  return (
    <Stack gap={4}>
      <Stack gap={1}>
        <HStack hAlign="between" vAlign="start" wrap="wrap" gap={2}>
          <Heading level={2}>{job.title}</Heading>
          {showPageLink ? (
            <Button label="Open page" variant="ghost" size="sm" href={ROUTES.job(job.id)} />
          ) : null}
        </HStack>
        <Text color="secondary">
          <Link href={ROUTES.companyPublic(job.companySlug)}>{job.company}</Link>
          {" · "}
          {job.location}
          {" · "}
          {job.posted}
        </Text>
      </Stack>

      <HStack gap={2} wrap="wrap">
        <Badge label={WORKPLACE_LABEL[job.workplace]} variant="neutral" />
        <Badge label={job.seniority} variant="neutral" />
        <Badge label={job.employment} variant="neutral" />
        <Badge label={SOURCE_LABEL[job.source]} variant={job.source === "scouted" ? "purple" : "info"} />
        {job.visa ? <Badge label="Visa" variant="teal" /> : null}
        {job.match != null ? (
          <Badge label={`${job.match}% match`} variant={job.match >= MATCH_THRESHOLD ? "success" : "neutral"} />
        ) : null}
      </HStack>

      <MetadataList columns={3}>
        <MetadataListItem label="Pay">{job.salary}</MetadataListItem>
        <MetadataListItem label="Where">{WORKPLACE_LABEL[job.workplace]}</MetadataListItem>
        <MetadataListItem label="Source">{SOURCE_LABEL[job.source]}</MetadataListItem>
      </MetadataList>

      <Text display="block">{job.summary}</Text>

      <Stack gap={2}>
        <Heading level={3}>Requirements</Heading>
        <List listStyle="disc">
          {job.requirements.map((item) => (
            <ListItem key={item} label={item} />
          ))}
        </List>
      </Stack>

      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button
          label={direct ? "Apply" : "Apply on company site"}
          variant="primary"
          onClick={() => setNote(direct ? "Application started with your default resume." : "Marked as applied.")}
        />
        <Button label={isSaved ? "Saved" : "Save"} variant="secondary" onClick={toggleSave} />
      </HStack>
      <Text type="supporting" color="secondary" display="block">
        {note ??
          (direct
            ? "Direct jobs apply here with your profile and resume."
            : "This opens the official listing. We’ll ask if you applied when you come back.")}
      </Text>
    </Stack>
  );
}
