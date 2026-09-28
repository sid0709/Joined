import { Badge, HStack, ListItem, Stack, StackItem, Text } from "@openseat/design-system";
import { lastActivity, threadPreview, type MailThread } from "@/lib/messages";
import { ThreadAvatar } from "./thread-avatar";

const AVATAR_SIZE = 40;

/** One conversation in the list: who, what it's about, the last word, and whether it's new. */
export function ThreadRow({
  thread,
  isSelected,
  onOpen,
}: {
  thread: MailThread;
  isSelected: boolean;
  onOpen: () => void;
}) {
  const isUnread = thread.unread > 0;
  const context = thread.stage ? `${thread.subtitle} · ${thread.stage}` : thread.subtitle;

  return (
    <ListItem
      isSelected={isSelected}
      onClick={onOpen}
      aria-current={isSelected ? "true" : undefined}
      startContent={<ThreadAvatar thread={thread} size={AVATAR_SIZE} />}
      label={
        <HStack gap={2} vAlign="center">
          <StackItem size="fill">
            <Text weight={isUnread ? "semibold" : "medium"} maxLines={1}>
              {thread.title}
            </Text>
          </StackItem>
          <Text
            type="supporting"
            color={isUnread ? "accent" : "secondary"}
            weight={isUnread ? "medium" : undefined}
            hasTabularNumbers
          >
            {lastActivity(thread)}
          </Text>
        </HStack>
      }
      description={
        <Stack gap={0.5}>
          <Text type="supporting" color="secondary" maxLines={1}>
            {context}
          </Text>
          <HStack gap={2} vAlign="center">
            <StackItem size="fill">
              <Text
                type="supporting"
                color={isUnread ? "primary" : "secondary"}
                weight={isUnread ? "medium" : undefined}
                maxLines={1}
              >
                {threadPreview(thread)}
              </Text>
            </StackItem>
            {isUnread ? (
              <StackItem size="static">
                <Badge
                  label={String(thread.unread)}
                  variant="info"
                  aria-label={`${thread.unread} unread`}
                />
              </StackItem>
            ) : null}
          </HStack>
        </Stack>
      }
    />
  );
}
