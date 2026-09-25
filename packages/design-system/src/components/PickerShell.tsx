"use client";

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { IconButton } from "./Action";
import { icons, type GlyphName } from "./Glyph";
import { Icon } from "./Primitives";
import type { ControlSize } from "./size";
import { useDismiss } from "./hooks";

export interface PickerShellProps {
  /** Typed segments rendered inside the control. */
  segments: ReactNode;
  /** The dropdown panel. Omit for a type-only field. */
  panel?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: GlyphName;
  /** Accessible name for the segments group and the panel. */
  label: string;
  labelledBy?: string;
  size?: ControlSize;
  error?: boolean;
  disabled?: boolean;
}

/** Space between the field and its panel, in px. */
const PANEL_GAP = 8;

/**
 * The shared chrome for typed date and time fields: an Input-shaped control
 * that you can type into, plus a trigger that drops a picker panel below it.
 */
export function PickerShell({
  segments,
  panel,
  open,
  onOpenChange,
  icon,
  label,
  labelledBy,
  size = "md",
  error,
  disabled,
}: PickerShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useDismiss(rootRef, open, close);

  // Fixed positioning escapes cards that clip overflow; flip above when below is short.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    function place() {
      const field = controlRef.current?.getBoundingClientRect();
      const height = panelRef.current?.offsetHeight ?? 0;
      if (!field) return;
      const below = window.innerHeight - field.bottom - PANEL_GAP;
      const flip = height > below && field.top > below;
      setPosition({ left: field.left, top: flip ? field.top - PANEL_GAP - height : field.bottom + PANEL_GAP });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  const shell = [
    "os-control",
    `os-control-${size}`,
    "os-picker-control",
    error && "os-control-error",
    disabled && "os-control-disabled",
    open && "os-picker-control-open",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className="os-picker">
      <div ref={controlRef} className={shell}>
        <div className="os-segments" role="group" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy}>
          {segments}
        </div>
        {panel && (
          <IconButton
            className="os-picker-trigger"
            label={open ? `Close ${label.toLowerCase()} picker` : `Open ${label.toLowerCase()} picker`}
            aria-expanded={open}
            aria-haspopup="dialog"
            variant="ghost"
            size="sm"
            isDisabled={disabled}
            icon={<Icon icon={icons[icon]} />}
            onClick={() => onOpenChange(!open)}
          />
        )}
      </div>
      {panel && open && (
        <div
          ref={panelRef}
          className="os-picker-panel"
          role="dialog"
          aria-label={label}
          style={position ?? { visibility: "hidden" }}
        >
          {panel}
        </div>
      )}
    </div>
  );
}
