"use client";

import { Glyph, type GlyphName } from "sid-ui";
import Link from "next/link";
import { useState } from "react";

import type { BidderNotificationKind } from "@/src/candidate/types/workspace";

import { ACCOUNT_LINKS, SectionNav } from "@/src/candidate/components/ui/SectionNav";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Panel } from "@/src/shared/kit/Panel";
import { Tabs } from "@/src/shared/kit/Tabs";
import { relativeTime } from "@/src/shared/lib/format";
import { Button, PageBody } from "@/src/shared/marketplace-ui";

type Filter = "all" | "unread" | BidderNotificationKind;

const ICON: Record<BidderNotificationKind, GlyphName> = {
  invitation: "mail",
  message: "chat",
  review: "eye",
  payout: "download",
  work: "list",
  system: "sparkle",
};

export function NotificationsView() {
  const { notifications, markNotificationRead, markAllNotificationsRead, unreadNotifications } =
    useBidderWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const visible = notifications.filter((item) =>
    filter === "all" ? true : filter === "unread" ? !item.read : item.kind === filter,
  );

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Notifications"
          title="Everything that needs you"
          description="Invitations, hunter replies, reviews, new links and payouts all land here. Open an item to jump straight to where you can act."
          actions={
            <Button
              variant="secondary"
              label="Mark all as read"
              disabled={!unreadNotifications}
              onClick={markAllNotificationsRead}
            />
          }
        />
        <SectionNav label="Account sections" links={ACCOUNT_LINKS} />
        <div className="hx-toolbar">
          <Tabs
            label="Filter notifications"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "unread", label: `Unread (${unreadNotifications})` },
              { value: "invitation", label: "Invitations" },
              { value: "message", label: "Messages" },
              { value: "review", label: "Reviews" },
              { value: "work", label: "Work" },
              { value: "payout", label: "Payouts" },
            ]}
          />
        </div>
        <Panel flush>
          {visible.length === 0 ? (
            <EmptyBlock
              icon="bell"
              title="You are all caught up"
              description="New updates will show up here."
            />
          ) : (
            <ul className="hx-list">
              {visible.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="hx-list-item"
                    data-active={!item.read}
                    onClick={() => markNotificationRead(item.id)}
                  >
                    <span className="bx-attention-icon">
                      <Glyph name={ICON[item.kind]} size="1.05em" />
                    </span>
                    <span className="hx-list-body">
                      <span className="hx-list-title">{item.title}</span>
                      <span className="hx-list-meta">{item.body}</span>
                    </span>
                    <span className="hx-small hx-faint">{relativeTime(item.at)}</span>
                    {!item.read && <span className="bx-dot" aria-label="Unread" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageBody>
  );
}
