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
} from "@joined/design-system";
import { completeness, profileChecklist, type ApplicantProfile } from "@/lib/workspace/profile";

const AVATAR_SIZE = 72;
const READY = 80;
const HALF = 50;

/** Who Acorn applies as, at a glance, and what an application could still ask for. */
export function ProfileSummary({ profile, years }: { profile: ApplicantProfile; years: number }) {
  const current = profile.timeline.find((entry) => entry.kind === "role" && entry.current);
  const checklist = profileChecklist(profile);
  const percent = completeness(checklist);
  const links = [
    { label: "LinkedIn", href: profile.linkedin },
    { label: "GitHub", href: profile.github },
    { label: "Portfolio", href: profile.portfolio },
  ].filter((link) => link.href.trim());

  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={3} hAlign="center">
          <Avatar name={profile.fullName} size={AVATAR_SIZE} />
          <Stack gap={1} hAlign="center">
            <Heading level={2}>{profile.fullName || "Your name"}</Heading>
            <Text color="secondary">
              {current ? `${current.title} · ${current.org}` : "Add your current role"}
            </Text>
          </Stack>
          <HStack gap={2} wrap="wrap" hAlign="center">
            {profile.city ? (
              <Badge
                label={`${profile.city}, ${profile.state}`}
                variant="neutral"
                icon={<Glyph name="pin" />}
              />
            ) : null}
            {profile.visaSponsorship.startsWith("No") ? (
              <Badge label="No sponsorship needed" variant="success" />
            ) : null}
          </HStack>
        </Stack>
        <MetadataList columns={2}>
          <MetadataListItem label="Experience">{`${years} years`}</MetadataListItem>
          <MetadataListItem label="Target salary">
            {profile.desiredSalary ? `$${Number(profile.desiredSalary).toLocaleString()}` : "—"}
          </MetadataListItem>
          <MetadataListItem label="Email">{profile.email}</MetadataListItem>
          <MetadataListItem label="AI model">{profile.modelName}</MetadataListItem>
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
          <ProgressBar
            label="Application answers"
            value={percent}
            hasValueLabel
            variant={percent >= READY ? "success" : percent >= HALF ? "accent" : "warning"}
          />
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
      </Stack>
    </Card>
  );
}
