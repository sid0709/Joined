import { Fragment, type ReactNode } from "react";
import { Glyph } from "./Glyph";

export type TimelineTone = "neutral" | "accent" | "success" | "warning" | "danger";

/** done fills the marker and the rail behind it; current glows; upcoming stays hollow. */
export type TimelineStatus = "done" | "current" | "upcoming";

export interface TimelineItem {
  id: string;
  title: string;
  time?: string;
  description?: string;
  meta?: ReactNode;
  /** Replaces the dot — an initial, icon, or avatar. */
  marker?: ReactNode;
  tone?: TimelineTone;
  status?: TimelineStatus;
  /** Items that share a group sit under one heading, such as "Today". */
  group?: string;
}

/**
 * rail       — the default: dots on a line, time beside the title.
 * compact    — a log: time in its own column, one line per event.
 * cards      — each event on its own surface.
 * alternate  — events swap sides of a centred rail.
 * horizontal — a left-to-right track, like milestones.
 * activity   — larger markers for people and icons, feed-style.
 */
export type TimelineVariant = "rail" | "compact" | "cards" | "alternate" | "horizontal" | "activity";

export interface TimelineProps {
  items: TimelineItem[];
  variant?: TimelineVariant;
  /** Accessible name for the list. */
  label?: string;
}

function Marker({ item }: { item: TimelineItem }) {
  const status = item.status ?? "plain";
  const content = item.marker ?? (status === "done" ? <Glyph name="check" /> : null);
  return (
    <span
      className={[
        "os-tl-marker",
        `os-tl-tone-${item.tone ?? "accent"}`,
        `os-tl-${status}`,
        item.marker != null && "os-tl-marker-custom",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      {content}
    </span>
  );
}

/** A sequence of events. Tone colors the marker; the title always says what happened. */
export function Timeline({ items, variant = "rail", label = "Timeline" }: TimelineProps) {
  const grouped = variant !== "horizontal";

  return (
    <ol className={`os-tl os-tl-${variant}`} aria-label={label}>
      {items.map((item, index) => {
        const heading = grouped && item.group && item.group !== items[index - 1]?.group ? item.group : null;
        const nextStatus = items[index + 1]?.status;
        return (
          <Fragment key={item.id}>
            {heading && (
              <li className="os-tl-heading" role="presentation">
                <span>{heading}</span>
              </li>
            )}
            <li
              className={[
                "os-tl-item",
                `os-tl-item-${item.status ?? "plain"}`,
                nextStatus === "upcoming" && "os-tl-item-before-upcoming",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={item.status === "current" ? "step" : undefined}
            >
              {variant === "compact" && item.time && <time className="os-tl-time os-tl-time-lead">{item.time}</time>}
              <span className="os-tl-track">
                <Marker item={item} />
              </span>
              <div className="os-tl-body">
                <div className="os-tl-head">
                  <p className="os-tl-title">{item.title}</p>
                  {variant !== "compact" && item.time && <time className="os-tl-time">{item.time}</time>}
                </div>
                {item.description && <p className="os-tl-desc">{item.description}</p>}
                {item.meta && <div className="os-tl-meta">{item.meta}</div>}
              </div>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
