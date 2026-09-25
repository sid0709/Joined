"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

const SEGMENT_SELECTOR = "[data-os-segment]";

function siblings(from: HTMLElement) {
  const root = from.closest(".os-segments");
  return root ? Array.from(root.querySelectorAll<HTMLElement>(SEGMENT_SELECTOR)) : [from];
}

function focusSibling(from: HTMLElement, offset: 1 | -1) {
  const list = siblings(from);
  list[list.indexOf(from) + offset]?.focus();
}

export interface NumberSegmentProps {
  value: number | null;
  min: number;
  max: number;
  /** Digits shown, e.g. 2 for "09" or 4 for a year. */
  digits: number;
  placeholder: string;
  label: string;
  onChange: (value: number | null) => void;
  /** Maps the stored value to what is shown, e.g. 13 → "01" on a 12-hour field. */
  format?: (value: number) => string;
  disabled?: boolean;
}

/**
 * One typed part of a date or time. Digits fill it and hop to the next part;
 * arrows step and wrap; Backspace clears, then moves back.
 */
export function NumberSegment({ value, min, max, digits, placeholder, label, onChange, format, disabled }: NumberSegmentProps) {
  // State drives what is shown; the ref is what handlers read, so fast typing
  // and the blur that follows an auto-advance never see a stale buffer.
  const [buffer, setBufferState] = useState("");
  const bufferRef = useRef("");
  function setBuffer(next: string) {
    bufferRef.current = next;
    setBufferState(next);
  }

  function step(delta: number) {
    const span = max - min + 1;
    const base = value ?? (delta > 0 ? min - 1 : max + 1);
    onChange(((base - min + delta + span) % span + span) % span + min);
  }

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    const el = event.currentTarget;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      setBuffer("");
      step(event.key === "ArrowUp" ? 1 : -1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusSibling(el, 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusSibling(el, -1);
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      if (bufferRef.current) setBuffer(bufferRef.current.slice(0, -1));
      else if (value != null) onChange(null);
      else focusSibling(el, -1);
    } else if (/^\d$/.test(event.key)) {
      event.preventDefault();
      let next = bufferRef.current + event.key;
      if (Number(next) > max) next = event.key;
      const parsed = Number(next);
      const complete = next.length >= digits || parsed * 10 > max;
      if (complete) {
        setBuffer("");
        onChange(Math.min(Math.max(parsed, min), max));
        focusSibling(el, 1);
      } else {
        setBuffer(next);
      }
    }
  }

  const shown = buffer
    ? buffer.padStart(digits, "0")
    : value == null
      ? placeholder
      : format
        ? format(value)
        : String(value).padStart(digits, "0");

  return (
    <span
      data-os-segment=""
      role="spinbutton"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value == null ? "Empty" : shown}
      aria-disabled={disabled || undefined}
      className={value == null && !buffer ? "os-segment os-segment-empty" : "os-segment"}
      onKeyDown={disabled ? undefined : onKeyDown}
      onBlur={() => {
        const pending = bufferRef.current;
        if (pending && Number(pending) >= min) onChange(Number(pending));
        setBuffer("");
      }}
    >
      {shown}
    </span>
  );
}

export interface ChoiceSegmentProps<T extends string> {
  value: T | null;
  options: readonly T[];
  placeholder: string;
  label: string;
  onChange: (value: T) => void;
  disabled?: boolean;
}

/** A typed part with a closed set — AM/PM. Type its first letter or step with arrows. */
export function ChoiceSegment<T extends string>({ value, options, placeholder, label, onChange, disabled }: ChoiceSegmentProps<T>) {
  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    const el = event.currentTarget;
    const index = value == null ? -1 : options.indexOf(value);
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const delta = event.key === "ArrowUp" ? 1 : -1;
      onChange(options[(index + delta + options.length) % options.length]);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusSibling(el, 1);
    } else if (event.key === "ArrowLeft" || event.key === "Backspace") {
      event.preventDefault();
      focusSibling(el, -1);
    } else {
      const hit = options.find((option) => option.toLowerCase().startsWith(event.key.toLowerCase()));
      if (hit) {
        event.preventDefault();
        onChange(hit);
      }
    }
  }

  return (
    <span
      data-os-segment=""
      role="spinbutton"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuetext={value ?? "Empty"}
      aria-disabled={disabled || undefined}
      className={value == null ? "os-segment os-segment-empty" : "os-segment"}
      onKeyDown={disabled ? undefined : onKeyDown}
    >
      {value ?? placeholder}
    </span>
  );
}

export function SegmentDivider({ children }: { children: ReactNode }) {
  return (
    <span className="os-segment-divider" aria-hidden>
      {children}
    </span>
  );
}
