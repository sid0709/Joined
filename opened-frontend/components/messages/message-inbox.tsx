"use client";

import { useRef, useState } from "react";
import {
  CONTAINER_TIERS,
  Card,
  Drawer,
  EmptyState,
  Icon,
  Layout,
  LayoutContent,
  LayoutPanel,
  icons,
  useElementWidth,
} from "@openseat/design-system";
import type { MailMessage, MailThread } from "@/lib/messages";
import { Conversation } from "./conversation";
import { ConversationDetails } from "./conversation-details";
import { ThreadList } from "./thread-list";
import { useInbox } from "./use-inbox";

const LIST_WIDTH = 340;
const DETAILS_WIDTH = 300;
/** Below this the list and the conversation take turns; above it they sit side by side. */
const SPLIT_MIN_WIDTH = CONTAINER_TIERS.lg;
/** Room for the details panel beside the conversation; narrower opens it in a drawer. */
const DOCK_MIN_WIDTH = CONTAINER_TIERS.xl;

/**
 * A full-height messaging workspace: conversations on the left, the open
 * thread in the middle, its context on the right. It adapts to its own width,
 * so it fits a full page or a column beside the employer rail.
 * Give it a height — wrap it in `Sticky fill`.
 */
export function MessageInbox({
  title,
  threads,
  privacyNote,
  sendMessage,
  refreshThread,
}: {
  title: string;
  threads: MailThread[];
  privacyNote: string;
  sendMessage?: (id: string, text: string) => Promise<MailMessage>;
  refreshThread?: (id: string) => Promise<MailThread>;
}) {
  const inbox = useInbox(threads, { sendMessage, refreshThread });
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref);
  // Width is 0 until measured; assume the wide layout so desktop never flashes a single pane.
  const isMeasured = width > 0;
  const isSplit = !isMeasured || width >= SPLIT_MIN_WIDTH;
  const canDock = isMeasured && width >= DOCK_MIN_WIDTH;

  const [detailsPreferred, setDetailsPreferred] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [threadShown, setThreadShown] = useState(false);

  const selected = inbox.selected;
  const isDetailsOpen = canDock ? detailsPreferred : drawerOpen;
  const toggleDetails = () =>
    canDock ? setDetailsPreferred((open) => !open) : setDrawerOpen((open) => !open);

  const list = (
    <ThreadList
      title={title}
      inbox={{
        ...inbox,
        open: (id) => {
          inbox.open(id);
          setThreadShown(true);
        },
      }}
    />
  );

  const conversation = selected ? (
    <Conversation
      inbox={inbox}
      isDetailsOpen={isDetailsOpen}
      onToggleDetails={toggleDetails}
      onBack={isSplit ? undefined : () => setThreadShown(false)}
    />
  ) : (
    <EmptyState
      icon={<Icon icon={icons.chat} size="lg" color="secondary" />}
      title="Pick a conversation"
      description="Choose a thread on the left to read and reply."
    />
  );

  const content = isSplit ? conversation : threadShown && selected ? conversation : list;

  return (
    <Card ref={ref} padding={0} elevation="low" height="100%">
      <Layout
        height="fill"
        start={
          isSplit ? (
            <LayoutPanel width={LIST_WIDTH} hasDivider padding={0} label="Conversations">
              {list}
            </LayoutPanel>
          ) : undefined
        }
        content={<LayoutContent padding={0}>{content}</LayoutContent>}
        end={
          canDock && detailsPreferred && selected ? (
            <LayoutPanel
              width={DETAILS_WIDTH}
              hasDivider
              isScrollable
              padding={5}
              label="Conversation details"
            >
              <ConversationDetails thread={selected} privacyNote={privacyNote} />
            </LayoutPanel>
          ) : undefined
        }
      />
      <Drawer
        isOpen={!canDock && drawerOpen && selected !== null}
        onOpenChange={setDrawerOpen}
        title="Details"
        size="sm"
      >
        {selected ? <ConversationDetails thread={selected} privacyNote={privacyNote} /> : null}
      </Drawer>
    </Card>
  );
}
