import {
  Avatar,
  Badge,
  Card,
  Divider,
  Glyph,
  HStack,
  Heading,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
} from "sid-ui";
import { formatTime } from "@/lib/dates";
import { INTERVIEW_LENGTHS, WEEKDAYS, type HiringProfile } from "@/lib/company";
import { TIME_ZONES } from "@/lib/settings";

const AVATAR_SIZE = 60;

function labelOf(options: { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** Mon, Tue, Wed, Thu → "Mon–Thu" when the days run together. */
function dayRange(days: string[]) {
  const order = WEEKDAYS.map((day) => day.value);
  const picked = order.filter((day) => days.includes(day));
  if (picked.length === 0) return "No days set";
  const first = order.indexOf(picked[0]);
  const isRun = picked.every((day, index) => order.indexOf(day) === first + index);
  const labels = picked.map((day) => labelOf(WEEKDAYS, day));
  return isRun && labels.length > 2 ? `${labels[0]}–${labels.at(-1)}` : labels.join(", ");
}

/** Your card as candidates meet it — on messages, interview invites, and your jobs. */
export function HiringProfilePreview({
  name,
  company,
  profile,
}: {
  name: string;
  company: string;
  profile: HiringProfile;
}) {
  return (
    <Card padding={5} elevation="low">
      <Stack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={2}>
          <Text type="label" color="secondary">
            How candidates see you
          </Text>
          <Badge
            label={profile.isVisibleToCandidates ? "Visible" : "Hidden"}
            variant={profile.isVisibleToCandidates ? "success" : "neutral"}
          />
        </HStack>

        {profile.isVisibleToCandidates ? (
          <>
            <HStack gap={3} vAlign="center">
              <Avatar name={name} size={AVATAR_SIZE} tooltip={false} />
              <Stack gap={0.5}>
                <Heading level={3}>{name}</Heading>
                <Text type="supporting" color="secondary">
                  {profile.title ? `${profile.title} · ${company}` : company}
                </Text>
              </Stack>
            </HStack>
            {profile.about ? <Text display="block">{profile.about}</Text> : null}
          </>
        ) : (
          <Text color="secondary" display="block">
            {`Candidates see “${company} hiring team” instead of your name and photo.`}
          </Text>
        )}

        <Divider />

        <MetadataList>
          <MetadataListItem label="Interviews">
            {`${labelOf(INTERVIEW_LENGTHS, profile.interviewLength)} · video`}
          </MetadataListItem>
          <MetadataListItem label="Available">
            {`${dayRange(profile.interviewDays)}, ${formatTime(profile.dayStart)}–${formatTime(profile.dayEnd)}`}
          </MetadataListItem>
          <MetadataListItem label="Time zone">
            {labelOf(TIME_ZONES, profile.timeZone)}
          </MetadataListItem>
        </MetadataList>

        {profile.signature ? (
          <>
            <Divider />
            <HStack gap={2} vAlign="start">
              <Text type="supporting" color="secondary">
                <Glyph name="mail" />
              </Text>
              <Stack gap={0.5}>
                <Text type="supporting" color="secondary">
                  Message signature
                </Text>
                <Text type="supporting">{`${name} · ${profile.signature}`}</Text>
              </Stack>
            </HStack>
          </>
        ) : null}
      </Stack>
    </Card>
  );
}
