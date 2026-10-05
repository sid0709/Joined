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
} from "@joined/design-system";
import { STRONG_SCORE, isProfileResume, type Resume } from "@/lib/resumes";
import type { Profile } from "@/lib/profile";
import { ResumeDocument } from "./resume-document";

/** Completeness, parsed sections, and a live preview of the selected version. */
export function ResumeInsights({
  resume,
  profile,
  onSetDefault,
  onDownload,
}: {
  resume: Resume;
  profile?: Profile;
  onSetDefault: () => void;
  onDownload: () => void;
}) {
  const strong = resume.score >= STRONG_SCORE;
  const isProfile = isProfileResume(resume.id);

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

        {resume.file ? (
          <Banner
            status="info"
            title="File stays on this device"
            description={resume.suggestions[0]}
          />
        ) : null}

        {resume.parse === "parsed" ? (
          <>
            <Stack gap={2}>
              <HStack hAlign="between" vAlign="end">
                <Text type="label">{isProfile ? "Completeness" : "Readability"}</Text>
                <Heading level={3} type="display-3">
                  {`${resume.score}`}
                </Heading>
              </HStack>
              <ProgressBar
                label={isProfile ? "Completeness" : "Readability"}
                isLabelHidden
                value={resume.score}
                variant={strong ? "success" : "warning"}
              />
              <Text type="supporting" color="secondary" display="block">
                {isProfile
                  ? strong
                    ? "Contact, summary, experience, education, and skills are filled in."
                    : "Fill the sections below so applications go out with a complete résumé."
                  : strong
                    ? "Recruiter systems read this cleanly."
                    : "Some sections may be missed by recruiter systems."}
              </Text>
            </Stack>

            {isProfile && profile ? (
              <>
                <Divider />
                <ResumeDocument profile={profile} />
              </>
            ) : (
              <>
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
              </>
            )}

            {resume.suggestions.length > 0 && !resume.file ? (
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
            label={isProfile ? "Export" : "Download"}
            variant="secondary"
            icon={<Icon icon={icons.download} />}
            onClick={onDownload}
          />
        </HStack>
      </Stack>
    </Card>
  );
}
