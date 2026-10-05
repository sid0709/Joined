import { Badge, Card, Divider, EmptyState, Glyph, HStack, Heading, Stack, Text } from "sid-ui";
import type { AcornAccount } from "@/lib/auth/session";
import { formatWhen, type ResumeDraft } from "@/lib/workspace/model";
import { entryDates, type ApplicantProfile } from "@/lib/workspace/profile";

const ROLES_SHOWN = 3;

/** The draft laid out like the page it becomes: header, summary, focus, experience. */
export function ResumePreview({
  account,
  profile,
  resume,
}: {
  account: AcornAccount;
  profile: ApplicantProfile;
  resume: ResumeDraft | null;
}) {
  if (!resume) {
    return (
      <Card padding={6}>
        <EmptyState
          icon={<Glyph name="file" />}
          title="No draft yet"
          description="Add a role and generate. The draft shows up here."
        />
      </Card>
    );
  }
  const roles = profile.timeline.filter((entry) => entry.kind === "role").slice(0, ROLES_SHOWN);
  const education = profile.timeline.filter((entry) => entry.kind === "education");
  const contact = [
    account.email,
    profile.phone,
    profile.city && `${profile.city}, ${profile.state}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card padding={6}>
      <Stack gap={5}>
        <HStack hAlign="between" vAlign="start" gap={3} wrap="wrap">
          <Stack gap={1}>
            <Heading level={2}>{profile.fullName || account.name}</Heading>
            <Text color="secondary">{contact}</Text>
          </Stack>
          <HStack gap={2} wrap="wrap">
            <Badge label={resume.company ? `For ${resume.company}` : "Draft"} variant="blue" />
            {formatWhen(resume.createdAt) ? (
              <Badge
                label={formatWhen(resume.createdAt)}
                variant="neutral"
                icon={<Glyph name="clock" />}
              />
            ) : null}
          </HStack>
        </HStack>
        <Divider />
        <Stack gap={2}>
          <Text type="label" color="secondary">
            Summary
          </Text>
          <Text>{resume.summary}</Text>
        </Stack>
        {resume.focus.length > 0 ? (
          <Stack gap={2}>
            <Text type="label" color="secondary">
              {`Aimed at ${resume.role}`}
            </Text>
            <Stack gap={1}>
              {resume.focus.map((line) => (
                <HStack key={line} gap={2} vAlign="start">
                  <Glyph name="check" />
                  <Text>{line}</Text>
                </HStack>
              ))}
            </Stack>
          </Stack>
        ) : null}
        {roles.length > 0 ? (
          <Stack gap={3}>
            <Text type="label" color="secondary">
              Experience
            </Text>
            {roles.map((entry) => (
              <Stack key={entry.id} gap={0}>
                <HStack hAlign="between" gap={3} wrap="wrap">
                  <Text weight="semibold">{`${entry.title} · ${entry.org}`}</Text>
                  <Text type="supporting" color="secondary">
                    {entryDates(entry)}
                  </Text>
                </HStack>
                {entry.summary ? <Text color="secondary">{entry.summary}</Text> : null}
              </Stack>
            ))}
          </Stack>
        ) : null}
        {education.length > 0 ? (
          <Stack gap={2}>
            <Text type="label" color="secondary">
              Education
            </Text>
            {education.map((entry) => (
              <Text key={entry.id}>{`${entry.title} · ${entry.org}`}</Text>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}
