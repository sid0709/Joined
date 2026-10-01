import {
  Badge,
  EmptyState,
  HStack,
  Heading,
  Icon,
  Layout,
  LayoutContent,
  LayoutHeader,
  List,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  TextInput,
  icons,
} from "@joined/design-system";
import { INBOX_FILTERS, type InboxFilter } from "@/lib/messages";
import { ThreadRow } from "./thread-row";
import type { InboxState } from "./use-inbox";

const EMPTY: Record<InboxFilter, { title: string; description: string }> = {
  inbox: { title: "No conversations yet", description: "When someone writes, it lands here." },
  unread: { title: "You’re all caught up", description: "Nothing new since you last looked." },
  archived: {
    title: "Nothing archived",
    description: "Archive a conversation to tidy your inbox.",
  },
};

/** The left rail: title and unread count, search, the view switch, then every conversation. */
export function ThreadList({ title, inbox }: { title: string; inbox: InboxState }) {
  const empty = inbox.query
    ? { title: "No matches", description: `Nothing matches “${inbox.query.trim()}”.` }
    : EMPTY[inbox.filter];

  return (
    <Layout
      height="fill"
      header={
        <LayoutHeader hasDivider padding={4}>
          <Stack gap={3}>
            <HStack gap={2} vAlign="center">
              <Heading level={1}>{title}</Heading>
              {inbox.counts.unread > 0 ? (
                <Badge label={`${inbox.counts.unread} unread`} variant="info" />
              ) : null}
            </HStack>
            <TextInput
              label="Search messages"
              isLabelHidden
              placeholder="Search people, jobs, or messages"
              startIcon={icons.search}
              value={inbox.query}
              onChange={inbox.setQuery}
              hasClear
            />
            <SegmentedControl
              label="Show"
              value={inbox.filter}
              onChange={(value) => inbox.setFilter(value as InboxFilter)}
              layout="fill"
              size="sm"
            >
              {INBOX_FILTERS.map((item) => (
                <SegmentedControlItem key={item.value} value={item.value} label={item.label} />
              ))}
            </SegmentedControl>
          </Stack>
        </LayoutHeader>
      }
      content={
        <LayoutContent isScrollable padding={2} label="Conversations">
          {inbox.threads.length === 0 ? (
            <EmptyState
              isCompact
              icon={<Icon icon={inbox.query ? icons.search : icons.chat} color="secondary" />}
              title={empty.title}
              description={empty.description}
            />
          ) : (
            <List>
              {inbox.threads.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  isSelected={thread.id === inbox.selected?.id}
                  onOpen={() => inbox.open(thread.id)}
                />
              ))}
            </List>
          )}
        </LayoutContent>
      }
    />
  );
}
