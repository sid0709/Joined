"use client";

import { useLinkComponent } from "@astryxdesign/core/Link";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from "react";

import { Glyph, type GlyphName } from "./Glyph";
import { lerpBox, parseDuration, parseEasing, type Box } from "./motion";

/** Larger counts read as "99+" so the bubble stays small. */
const MAX_COUNT = 99;
/** The theme tokens the sliding highlight moves with, so it lands together with the CSS label. */
const DURATION_TOKEN = "--duration-medium";
const EASING_TOKEN = "--ease-standard";
const ACTIVE_SELECTOR = '.os-pill[data-active="true"]';

export type PillNavItem = {
  href: string;
  label: string;
  icon: GlyphName;
  /** Unread or pending count; hidden at zero. */
  count?: number;
};

export type PillNavProps = {
  items: PillNavItem[];
  /** The href of the current page; that pill opens to show its label. */
  activeHref?: string;
  /** Names the navigation landmark. */
  label: string;
  /** `top` sits in a header; `bottom` is a fixed bar for small screens. */
  placement?: "top" | "bottom";
};

function boxOf(element: HTMLElement): Box {
  return { x: element.offsetLeft, width: element.offsetWidth };
}

/** A click the router will handle in this tab: primary button, no modifier keys. */
function isPlainClick(event: MouseEvent) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * Keeps one highlight under the active pill. When the active pill changes it glides there,
 * easing toward the pill's live box each frame, so it tracks the label as it opens and
 * finishes exactly on the final size. Between changes a ResizeObserver keeps it aligned.
 */
function useSlidingIndicator(
  trackRef: RefObject<HTMLDivElement | null>,
  indicatorRef: RefObject<HTMLSpanElement | null>,
  activeKey: string | undefined,
) {
  const lastBox = useRef<Box | null>(null);
  const isAnimating = useRef(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const indicator = indicatorRef.current;
    if (!track || !indicator) return;
    const target = () => track.querySelector<HTMLElement>(ACTIVE_SELECTOR);
    const place = (box: Box | null) => {
      lastBox.current = box;
      indicator.dataset.visible = box ? "true" : "false";
      if (!box) return;
      indicator.style.transform = `translateX(${box.x}px)`;
      indicator.style.width = `${box.width}px`;
    };

    const to = target();
    const from = lastBox.current;
    const styles = getComputedStyle(track);
    const duration = parseDuration(styles.getPropertyValue(DURATION_TOKEN));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!to || !from || reduceMotion || duration === 0) {
      place(to ? boxOf(to) : null);
      return;
    }

    const ease = parseEasing(styles.getPropertyValue(EASING_TOKEN));
    const start = performance.now();
    let frame = 0;
    isAnimating.current = true;
    const step = (now: number) => {
      const live = target();
      if (!live) return;
      const progress = Math.min(1, (now - start) / duration);
      place(lerpBox(from, boxOf(live), ease(progress)));
      if (progress < 1) frame = requestAnimationFrame(step);
      else isAnimating.current = false;
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      isAnimating.current = false;
    };
  }, [activeKey, trackRef, indicatorRef]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const indicator = indicatorRef.current;
    if (!track || !indicator) return;
    const observer = new ResizeObserver(() => {
      if (isAnimating.current) return;
      const active = track.querySelector<HTMLElement>(ACTIVE_SELECTOR);
      if (!active) return;
      const box = boxOf(active);
      lastBox.current = box;
      indicator.style.transform = `translateX(${box.x}px)`;
      indicator.style.width = `${box.width}px`;
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [trackRef, indicatorRef]);
}

/**
 * App navigation as a row of pills: each page is an icon, and the page you are on opens to
 * icon + label in the accent colour. A click opens the pill at once, before the next page
 * arrives, while one highlight slides across and the label opens to its natural width.
 */
export function PillNav({ items, activeHref, label, placement = "top" }: PillNavProps) {
  const LinkComponent = useLinkComponent();
  const trackRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  // The pill you clicked opens straight away; the route catches up and clears it.
  const [pendingHref, setPendingHref] = useState<string>();
  const [routedHref, setRoutedHref] = useState(activeHref);
  if (routedHref !== activeHref) {
    setRoutedHref(activeHref);
    setPendingHref(undefined);
  }
  const currentHref = pendingHref ?? activeHref;
  useSlidingIndicator(trackRef, indicatorRef, currentHref);

  const nav = (
    <nav aria-label={label} className="os-pill-nav" data-placement={placement}>
      <div ref={trackRef} className="os-pill-track">
        <span ref={indicatorRef} className="os-pill-indicator" aria-hidden />
        <ul className="os-pill-list">
          {items.map((item) => {
            const isActive = item.href === currentHref;
            const count = item.count && item.count > 0 ? item.count : 0;
            return (
              <li key={item.href}>
                <Tooltip content={item.label} isEnabled={!isActive}>
                  <LinkComponent
                    href={item.href}
                    className="os-pill"
                    data-active={isActive ? "true" : "false"}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={count ? `${item.label}, ${count}` : item.label}
                    onClick={(event: MouseEvent) => {
                      if (isPlainClick(event)) setPendingHref(item.href);
                    }}
                  >
                    <span className="os-pill-icon">
                      <Glyph name={item.icon} />
                      {count ? (
                        <span className="os-pill-count" aria-hidden>
                          {count > MAX_COUNT ? `${MAX_COUNT}+` : count}
                        </span>
                      ) : null}
                    </span>
                    <span className="os-pill-label" aria-hidden>
                      <span>{item.label}</span>
                    </span>
                  </LinkComponent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
  // A fixed bottom bar would cover the end of the page; the spacer keeps that content reachable.
  return placement === "bottom" ? (
    <>
      <div className="os-pill-nav-spacer" aria-hidden />
      {nav}
    </>
  ) : (
    nav
  );
}
