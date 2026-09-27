"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import { spacing, type SpacingStep } from "./breakpoints";

const SCROLLABLE = /(auto|scroll|overlay)/;

/** The nearest ancestor that scrolls vertically, or null for the window. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body) {
    if (SCROLLABLE.test(getComputedStyle(node).overflowY)) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Visible height of whatever scrolls the sticky element — the window or a
 * scroll container. The scroller is looked up again whenever layout changes,
 * because a container's overflow style can arrive after the first render.
 */
function useScrollportHeight(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let scroller: HTMLElement | null = null;
    const observer = new ResizeObserver(() => measure());
    function measure() {
      const next = scrollParent(el);
      if (next !== scroller) {
        if (scroller) observer.unobserve(scroller);
        if (next) observer.observe(next);
        scroller = next;
      }
      setHeight(scroller ? scroller.clientHeight : window.innerHeight);
    }
    if (el.parentElement) observer.observe(el.parentElement);
    measure();
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref, enabled]);
  return height;
}

export interface StickyProps {
  children: ReactNode;
  /** Gap kept above the element while stuck — a spacing step. With `fill`, also kept below. */
  offset?: SpacingStep;
  /**
   * Size the element to the visible scroll area, so a tall panel scrolls inside
   * itself instead of running past the fold. Pair with Layout height="fill".
   */
  fill?: boolean;
}

/**
 * Keeps a panel in view while its column scrolls — a detail pane beside a list,
 * a summary beside a form. Works in the window or any scroll container.
 */
export function Sticky({ children, offset = 0, fill = false }: StickyProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollport = useScrollportHeight(ref, fill);
  const style = {
    "--os-sticky-offset": spacing(offset),
    ...(fill && scrollport ? { "--os-sticky-scrollport": `${scrollport}px` } : {}),
  } as CSSProperties;
  return (
    <div ref={ref} className={fill ? "os-sticky os-sticky-fill" : "os-sticky"} style={style}>
      {children}
    </div>
  );
}
