import {
  Badge,
  Button,
  Divider,
  Glyph,
  HStack,
  Heading,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
} from "@openseat/design-system";
import type { MailThread } from "@/lib/messages";
import { ThreadAvatar } from "./thread-avatar";

const AVATAR_SIZE = 64;

/** The context beside a conversation: who, where things stand, and where to go next. */
export function ConversationDetails({
  thread,
  privacyNote,
}: {
  thread: MailThread;
  privacyNote: string;
}) {
  return (
    <Stack gap={5}>
      <Stack gap={3} hAlign="center">
        <ThreadAvatar thread={thread} size={AVATAR_SIZE} />
        <Stack gap={1} hAlign="center">
          <Heading level={3} justify="center">
            {thread.title}
          </Heading>
          <Text type="supporting" color="secondary" justify="center">
            {thread.subtitle}
          </Text>
        </Stack>
        {thread.stage ? <Badge label={thread.stage} variant="info" /> : null}
      </Stack>

      <Divider />

      <MetadataList>
        {thread.details.map((detail) => (
          <MetadataListItem key={detail.label} label={detail.label}>
            {detail.value}
          </MetadataListItem>
        ))}
      </MetadataList>

      {thread.links.length > 0 ? (
        <Stack gap={2}>
          {thread.links.map((link) => (
            <Button
              key={link.href}
              label={link.label}
              variant="secondary"
              href={link.href}
              width="100%"
            />
          ))}
        </Stack>
      ) : null}

      <Divider />

      <HStack gap={2} vAlign="start">
        <Text type="supporting" color="secondary">
          <Glyph name="lock" />
        </Text>
        <Text type="supporting" color="secondary">
          {privacyNote}
        </Text>
      </HStack>
    </Stack>
  );
}
