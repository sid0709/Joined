"use client";

import { Glyph, type GlyphName } from "sid-ui";
import Link from "next/link";
import { useState } from "react";

import type { NotificationKind } from "@/src/shared/types/marketplace";

import { useHunter } from "@/src/client/context/HunterContext";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Panel } from "@/src/shared/kit/Panel";
import { Tabs } from "@/src/shared/kit/Tabs";
import { relativeTime } from "@/src/shared/lib/format";
import { Button, PageBody } from "@/src/shared/marketplace-ui";

type Filter = "all" | "unread";

const ICON: Record<NotificationKind, GlyphName> = {
  inquiry: "users",
  message: "mail",
  qa: "check",
  billing: "download",
  task: "list",
  system: "bell",
};

export function NotificationsView() {
  const { notifications, markNotificationRead } = useHunter();
  const [filter, setFilter] = useState<Filter>("all");
  const unread = notifications.filter((item) => !item.read).length;
  const visible = notifications.filter((item) => filter === "all" || !item.read);

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Notifications"
          title="Everything that needs a reply"
          description="Bidder inquiries, QA results, invoices, and task activity in one place. Each item takes you straight to where you can act."
          actions={
            <Button
              variant="secondary"
              label="Mark all as read"
              disabled={!unread}
              onClick={() => markNotificationRead()}
            />
          }
        />
        <Tabs
          label="Filter notifications"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: `Unread (${unread})` },
          ]}
        />
        <Panel flush>
          {visible.length ? (
            <ul className="hx-list">
              {visible.map((item) => (
                <li key={item.id}>
                  <Link
                    className="hx-list-item"
                    href={item.href}
                    onClick={() => markNotificationRead(item.id)}
                    data-active={!item.read}
                  >
                    <span
                      className="hx-stat-icon"
                      data-tone={
                        item.kind === "billing"
                          ? "danger"
                          : item.kind === "qa"
                            ? "warning"
                            : item.kind === "system"
                              ? "success"
                              : "accent"
                      }
                    >
                      <Glyph name={ICON[item.kind]} />
                    </span>
                    <span className="hx-list-body">
                      <span className="hx-list-title">{item.title}</span>
                      <span className="hx-list-meta">{item.body}</span>
                    </span>
                    <span className="hx-small hx-muted">{relativeTime(item.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBlock
              icon="bell"
              title="You are all caught up"
              description="New activity will appear here."
            />
          )}
        </Panel>
      </div>
    </PageBody>
  );
}
