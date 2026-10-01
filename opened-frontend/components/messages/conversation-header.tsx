import {
  Badge,
  Button,
  HStack,
  Heading,
  Icon,
  IconButton,
  MoreMenu,
  Stack,
  StackItem,
  Text,
  icons,
} from "@joined/design-system";
import type { MailThread } from "@/lib/messages";
import { ThreadAvatar } from "./thread-avatar";

const AVATAR_SIZE = 40;

/** Who you're talking to and about what, with the thread's actions on the right. */
export function ConversationHeader({
  thread,
  isArchived,
  isDetailsOpen,
  onBack,
  onToggleDetails,
  onMarkUnread,
  onToggleArchive,
}: {
  thread: MailThread;
  isArchived: boolean;
  isDetailsOpen: boolean;
  /** Only in the single-pane layout, where the list is a screen away. */
  onBack?: () => void;
  onToggleDetails: () => void;
  onMarkUnread: () => void;
  onToggleArchive: () => void;
}) {
  const primary = thread.links[0];

  return (
    <HStack gap={3} vAlign="center">
      {onBack ? (
        <IconButton
          label="Back to conversations"
          icon={<Icon icon={icons.arrowLeft} />}
          variant="ghost"
          size="sm"
          onClick={onBack}
        />
      ) : null}
      <ThreadAvatar thread={thread} size={AVATAR_SIZE} />
      <StackItem size="fill">
        <Stack gap={0.5}>
          <HStack gap={2} vAlign="center">
            <Heading level={2} maxLines={1}>
              {thread.title}
            </Heading>
            {thread.stage ? <Badge label={thread.stage} variant="info" /> : null}
          </HStack>
          <Text type="supporting" color="secondary" maxLines={1}>
            {thread.subtitle}
          </Text>
        </Stack>
      </StackItem>
      <HStack gap={1} vAlign="center">
        {primary && !onBack ? (
          <Button label={primary.label} variant="secondary" size="sm" href={primary.href} />
        ) : null}
        <IconButton
          label={isDetailsOpen ? "Hide details" : "Show details"}
          tooltip={isDetailsOpen ? "Hide details" : "Show details"}
          icon={<Icon icon={icons.panelRight} />}
          variant={isDetailsOpen ? "secondary" : "ghost"}
          size="sm"
          onClick={onToggleDetails}
        />
        <MoreMenu
          label="Conversation actions"
          variant="ghost"
          size="sm"
          alignment="end"
          items={[
            { id: "unread", label: "Mark as unread", icon: icons.mail, onClick: onMarkUnread },
            {
              id: "archive",
              label: isArchived ? "Move to inbox" : "Archive",
              icon: icons.archive,
              onClick: onToggleArchive,
            },
          ]}
        />
      </HStack>
    </HStack>
  );
}
