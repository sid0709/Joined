import {
  ChatComposer,
  ChatLayout,
  ChatMessageList,
  Layout,
  LayoutContent,
  LayoutHeader,
  Stack,
} from "@joined/design-system";
import { BRAND } from "@/lib/routes";
import { ConversationHeader } from "./conversation-header";
import { MessageRuns } from "./message-runs";
import type { InboxState } from "./use-inbox";

/** The open conversation: header, the messages, and a composer that keeps a draft per thread. */
export function Conversation({
  inbox,
  isDetailsOpen,
  onToggleDetails,
  onBack,
}: {
  inbox: InboxState;
  isDetailsOpen: boolean;
  onToggleDetails: () => void;
  onBack?: () => void;
}) {
  const thread = inbox.selected;
  if (!thread) return null;
  const canReply = thread.kind !== "system";

  return (
    <Layout
      height="fill"
      header={
        <LayoutHeader hasDivider padding={4}>
          <ConversationHeader
            thread={thread}
            isArchived={inbox.isArchived(thread.id)}
            isDetailsOpen={isDetailsOpen}
            onBack={onBack}
            onToggleDetails={onToggleDetails}
            onMarkUnread={() => {
              inbox.markUnread(thread.id);
              onBack?.();
            }}
            onToggleArchive={() => inbox.toggleArchive(thread.id)}
          />
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={0} isScrollable={false}>
          {/* ChatLayout scrolls itself; it needs a definite-height flex parent to do so. */}
          <Stack height="100%">
            <ChatLayout
              key={thread.id}
              composer={
                <ChatComposer
                  value={inbox.draftFor(thread.id)}
                  onChange={(text) => inbox.setDraft(thread.id, text)}
                  onSubmit={(text) => inbox.send(thread.id, text)}
                  isDisabled={!canReply}
                  placeholder={
                    canReply ? `Message ${thread.title}` : `${BRAND} notices can’t be replied to`
                  }
                />
              }
            >
              <ChatMessageList>
                <MessageRuns thread={thread} />
              </ChatMessageList>
            </ChatLayout>
          </Stack>
        </LayoutContent>
      }
    />
  );
}
