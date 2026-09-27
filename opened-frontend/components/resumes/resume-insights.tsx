"use client";

import {
  Banner,
  Button,
  Card,
  Divider,
  HStack,
  Heading,
  Icon,
  MetadataList,
  MetadataListItem,
  ProgressBar,
  Spinner,
  Stack,
  Text,
  Token,
  icons,
} from "@openseat/design-system";
import { STRONG_SCORE, type Resume } from "@/lib/resumes";

/** What the parser read from the selected resume, and how to make it stronger. */
export function ResumeInsights({
  resume,
  onSetDefault,
  onDownload,
}: {
  resume: Resume;
  onSetDefault: () => void;
  onDownload: () => void;
}) {
  const strong = resume.score >= STRONG_SCORE;

  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={1}>
          <Text type="supporting" color="secondary">
            Selected version
          </Text>
          <Heading level={2}>{resume.label}</Heading>
          <Text type="supporting" color="secondary" maxLines={1}>
            {resume.fileName}
          </Text>
        </Stack>

        {resume.parse === "parsing" ? (
          <HStack gap={3} vAlign="center">
            <Spinner size="sm" />
            <Text color="secondary">Reading your resume…</Text>
          </HStack>
        ) : null}

        {resume.parse === "failed" ? (
          <Banner
            status="error"
            title="We couldn’t read this file"
            description={resume.suggestions[0]}
          />
        ) : null}

        {resume.parse === "parsed" ? (
          <>
            <Stack gap={2}>
              <HStack hAlign="between" vAlign="end">
                <Text type="label">Parser readability</Text>
                <Heading level={3} type="display-3">
                  {`${resume.score}`}
                </Heading>
              </HStack>
              <ProgressBar
                label="Parser readability"
                isLabelHidden
                value={resume.score}
                variant={strong ? "success" : "warning"}
              />
              <Text type="supporting" color="secondary" display="block">
                {strong
                  ? "Recruiter systems read this cleanly."
                  : "Some sections may be missed by recruiter systems."}
              </Text>
            </Stack>

            <Divider />

            <MetadataList>
              {resume.sections.map((section) => (
                <MetadataListItem key={section.label} label={section.label}>
                  {section.value}
                </MetadataListItem>
              ))}
            </MetadataList>

            {resume.skills.length > 0 ? (
              <Stack gap={2}>
                <Text type="label">Skills found</Text>
                <HStack gap={2} wrap="wrap">
                  {resume.skills.map((skill) => (
                    <Token key={skill} label={skill} size="sm" />
                  ))}
                </HStack>
              </Stack>
            ) : null}

            {resume.suggestions.length > 0 ? (
              <Stack gap={3}>
                <Text type="label">Suggestions</Text>
                {resume.suggestions.map((tip) => (
                  <HStack key={tip} gap={2} vAlign="start">
                    <Text color="accent">
                      <Icon icon={icons.sparkle} size="sm" color="inherit" />
                    </Text>
                    <Text type="supporting">{tip}</Text>
                  </HStack>
                ))}
              </Stack>
            ) : null}
          </>
        ) : null}

        <HStack gap={2} wrap="wrap">
          {!resume.isDefault && resume.parse === "parsed" ? (
            <Button label="Make default" variant="primary" onClick={onSetDefault} />
          ) : null}
          <Button
            label="Download"
            variant="secondary"
            icon={<Icon icon={icons.download} />}
            onClick={onDownload}
          />
        </HStack>
      </Stack>
    </Card>
  );
}
