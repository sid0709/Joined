import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Glyph,
  HStack,
  Heading,
  MetadataList,
  MetadataListItem,
  ProgressBar,
  Stack,
  StatusDot,
  Text,
} from "sid-ui";
import { completeness, profileChecklist, type ApplicantProfile } from "@/lib/workspace/profile";

const AVATAR_SIZE = 72;
const READY = 80;
const HALF = 50;

const answer = (value: string) => value.trim() || "Not answered";

/** Who Acorn applies as, how complete that is, and the screening answers it gives. */
export function ProfileSummary({
  profile,
  experience,
}: {
  profile: ApplicantProfile;
  /** Already formatted, e.g. "11 years 3 months". */
  experience: string;
}) {
  const current = profile.timeline.find((entry) => entry.kind === "role" && entry.current);
  const checklist = profileChecklist(profile);
  const percent = completeness(checklist);
  const done = checklist.filter((item) => item.done).length;
  const name = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(" ");
  const links = [
    { label: "LinkedIn", href: profile.linkedin },
    { label: "GitHub", href: profile.github },
    { label: "Portfolio", href: profile.portfolio },
  ].filter((link) => link.href.trim());

  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={3} hAlign="center">
          <Avatar name={name || profile.fullName} size={AVATAR_SIZE} />
          <Stack gap={1} hAlign="center">
            <Heading level={2}>{name || profile.fullName || "Your name"}</Heading>
            <Text color="secondary">
              {current ? `${current.title} · ${current.org}` : "Add your current role"}
            </Text>
          </Stack>
          {profile.city ? (
            <Badge
              label={`${profile.city}, ${profile.state}`}
              variant="neutral"
              icon={<Glyph name="pin" />}
            />
          ) : null}
        </Stack>
        <Stack gap={2}>
          <HStack hAlign="between" vAlign="end">
            <Text type="label" color="secondary">
              Profile completion
            </Text>
            <Heading level={2} type="display-3">
              {`${percent}%`}
            </Heading>
          </HStack>
          <ProgressBar
            label="Profile completion"
            isLabelHidden
            value={percent}
            variant={percent >= READY ? "success" : percent >= HALF ? "accent" : "warning"}
          />
          <Text type="supporting" color="secondary">
            {`${done} of ${checklist.length} sections answered`}
          </Text>
        </Stack>
        <MetadataList columns={2}>
          <MetadataListItem label="Experience">{experience}</MetadataListItem>
          <MetadataListItem label="Target salary">
            {profile.desiredSalary ? `$${Number(profile.desiredSalary).toLocaleString()}` : "—"}
          </MetadataListItem>
          <MetadataListItem label="Email">{profile.email}</MetadataListItem>
          <MetadataListItem label="Phone">{profile.phone || "—"}</MetadataListItem>
        </MetadataList>
        {links.length > 0 ? (
          <HStack gap={2} wrap="wrap">
            {links.map((link) => (
              <Button
                key={link.label}
                label={link.label}
                variant="secondary"
                size="sm"
                href={link.href}
                icon={<Glyph name="link" />}
              />
            ))}
          </HStack>
        ) : null}
        <Divider />
        <Stack gap={3}>
          <Text type="label" color="secondary">
            Screening answers
          </Text>
          <MetadataList columns="single" orientation="horizontal">
            <MetadataListItem label="Citizenship">{answer(profile.citizenship)}</MetadataListItem>
            <MetadataListItem label="Authorized to work">
              {answer(profile.workAuthorized)}
            </MetadataListItem>
            <MetadataListItem label="Sponsorship">
              {answer(profile.visaSponsorship)}
            </MetadataListItem>
            <MetadataListItem label="Public trust">{answer(profile.publicTrust)}</MetadataListItem>
            <MetadataListItem label="Clearance">
              {answer(profile.securityClearance)}
            </MetadataListItem>
            <MetadataListItem label="Race / ethnicity">
              {answer(profile.raceEthnicity)}
            </MetadataListItem>
          </MetadataList>
        </Stack>
        <Divider />
        <Stack gap={2}>
          {checklist.map((item) => (
            <HStack key={item.label} gap={2} vAlign="center">
              <StatusDot
                variant={item.done ? "success" : "neutral"}
                label={item.done ? "Done" : "Missing"}
              />
              <Text color={item.done ? "primary" : "secondary"}>{item.label}</Text>
            </HStack>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}
