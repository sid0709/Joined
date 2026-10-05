"use client";

import {
  Avatar,
  Badge,
  Glyph,
  IconButton,
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from "sid-ui";
import { MAIL_LABELS, MAIL_LABEL_ORDER, type MailLabel } from "@/lib/workspace/mail";
import type { Mailbox } from "@/lib/workspace/model";

/** "inbox" and "unread" are views; every other value is a label. */
export type MailView = "inbox" | "unread" | MailLabel;

function count(value: number, variant: "neutral" | "info" = "neutral") {
  return value > 0 ? <Badge label={String(value)} variant={variant} /> : undefined;
}

export function MailboxSidebar({
  name,
  mailboxes,
  view,
  onView,
  totals,
  labelNames,
  unread,
  onManage,
}: {
  name: string;
  mailboxes: Mailbox[];
  view: MailView;
  onView: (view: MailView) => void;
  totals: Record<MailLabel, number>;
  /** Gmail label names once auto-label has run; the Acorn category names until then. */
  labelNames?: Record<MailLabel, string | null>;
  unread: number;
  onManage: () => void;
}) {
  const primary = mailboxes.find((mailbox) => mailbox.isDefault) ?? mailboxes[0];
  return (
    <SideNav
      header={
        <SideNavHeading
          heading={name}
          subheading={primary?.email ?? "No mailbox connected"}
          icon={<Avatar name={name} size={32} />}
          headerEndContent={
            <IconButton
              label="Manage mailboxes"
              icon={<Glyph name="settings" />}
              variant="ghost"
              size="sm"
              onClick={onManage}
            />
          }
        />
      }
    >
      <SideNavSection title="Views">
        <SideNavItem
          label="Inbox"
          icon={<Glyph name="mail" />}
          isSelected={view === "inbox"}
          onClick={() => onView("inbox")}
          endContent={count(unread, "info")}
        />
        <SideNavItem
          label="Unread"
          icon={<Glyph name="dot" />}
          isSelected={view === "unread"}
          onClick={() => onView("unread")}
          endContent={count(unread)}
        />
      </SideNavSection>
      <SideNavSection title={labelNames ? "Gmail labels" : "Categories"}>
        {MAIL_LABEL_ORDER.map((label) => (
          <SideNavItem
            key={label}
            label={labelNames?.[label] ?? MAIL_LABELS[label].label}
            icon={<Glyph name={labelNames?.[label] ? "tag" : MAIL_LABELS[label].icon} />}
            isSelected={view === label}
            onClick={() => onView(label)}
            endContent={count(totals[label])}
          />
        ))}
      </SideNavSection>
      <SideNavSection title="Mailboxes">
        {mailboxes.map((mailbox) => (
          <SideNavItem
            key={mailbox.id}
            label={mailbox.label}
            icon={<Glyph name={mailbox.isDefault ? "star" : "archive"} />}
            onClick={onManage}
            endContent={mailbox.isDefault ? <Badge label="Default" variant="blue" /> : undefined}
          />
        ))}
        <SideNavItem label="Connect a mailbox" icon={<Glyph name="plus" />} onClick={onManage} />
      </SideNavSection>
    </SideNav>
  );
}
