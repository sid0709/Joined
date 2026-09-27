"use client";

import { Glyph } from "./Glyph";

import type { ReactNode } from "react";

/** Accent on the unread mark. The title always says what happened. */
export type NotificationTone = "accent" | "success" | "warning" | "danger" | "neutral";

export interface NotificationProps {
  /** Who or what this is about. */
  title: ReactNode;
  /** The one-line detail under the title. */
  description?: ReactNode;
  /** When it happened — a relative time or a short label. */
  time?: ReactNode;
  /** Leading visual — an avatar or an icon. */
  start?: ReactNode;
  /** A next step, such as a button or a link. */
  action?: ReactNode;
  /** Draws the unread mark. Read items stay quiet. */
  unread?: boolean;
  tone?: NotificationTone;
  href?: string;
  onClick?: () => void;
  /** Removes the item. The button is labelled for assistive tech. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

export interface NotificationListProps {
  children: ReactNode;
  /** Accessible name for the list. */
  label?: string;
  /** Title and actions above the list, such as “Mark all read”. */
  header?: ReactNode;
}

/** A feed of things that happened — unread marks, times, and optional actions. */
export function NotificationList({
  children,
  label = "Notifications",
  header,
}: NotificationListProps) {
  return (
    <section className="os-notes" aria-label={header ? undefined : label}>
      {header && <div className="os-notes-header">{header}</div>}
      <ul className="os-notes-list" aria-label={header ? label : undefined}>
        {children}
      </ul>
    </section>
  );
}

/** One item in a notification feed. Unread items announce themselves; the title carries the meaning. */
export function Notification({
  title,
  description,
  time,
  start,
  action,
  unread = false,
  tone = "accent",
  href,
  onClick,
  onDismiss,
  dismissLabel = "Dismiss",
}: NotificationProps) {
  const body = (
    <>
      <span
        className={["os-note-mark", unread && `os-note-tone-${tone}`].filter(Boolean).join(" ")}
        aria-hidden
      />
      <span className={start ? "os-note-start" : "os-note-start os-note-start-empty"}>{start}</span>
      <span className="os-note-body">
        <span className="os-note-title">{title}</span>
        {description != null && <span className="os-note-description">{description}</span>}
      </span>
      {time != null && <span className="os-note-time">{time}</span>}
    </>
  );

  return (
    <li className={["os-note", unread && "os-note-unread"].filter(Boolean).join(" ")}>
      {href ? (
        <a className="os-note-main" href={href}>
          {body}
          {unread && <span className="os-sr">Unread. </span>}
        </a>
      ) : onClick ? (
        <button type="button" className="os-note-main" onClick={onClick}>
          {body}
          {unread && <span className="os-sr">Unread. </span>}
        </button>
      ) : (
        <div className="os-note-main">
          {body}
          {unread && <span className="os-sr">Unread. </span>}
        </div>
      )}
      {action && <span className="os-note-action">{action}</span>}
      {onDismiss && (
        <button
          type="button"
          className="os-note-dismiss"
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          <Glyph name="close" />
        </button>
      )}
    </li>
  );
}
