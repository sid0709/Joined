"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { SegmentedControl, SegmentedControlItem } from "./Action";
import { Text } from "./Primitives";
import { tierFor } from "./breakpoints";
import { useElementWidth } from "./Responsive";

export interface FramePreset {
  label: string;
  /** px, or "fill" for the full available width. */
  width: number | "fill";
}

export const FRAME_PRESETS: FramePreset[] = [
  { label: "Phone", width: 360 },
  { label: "Tablet", width: 640 },
  { label: "Laptop", width: 880 },
  { label: "Fill", width: "fill" },
];

const MIN_FRAME_WIDTH = 280;
const KEY_STEP = 16;

export interface ResponsiveFrameProps {
  children: ReactNode;
  presets?: FramePreset[];
  /** Preset label to start on. */
  defaultPreset?: string;
  /** Accessible name for the frame. */
  label?: string;
}

/**
 * Shows content at a chosen width. Pick a device preset or drag the edge;
 * everything inside measures this frame as its container, so GridSystem,
 * ResponsiveStack, Show/Hide, and Astryx Grid all reflow live.
 */
export function ResponsiveFrame({ children, presets = FRAME_PRESETS, defaultPreset = "Fill", label = "Responsive preview" }: ResponsiveFrameProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  /** What children actually get — presets size the content box, not the chrome. */
  const actual = useElementWidth(contentRef);
  const initial = presets.find((p) => p.label === defaultPreset)?.width ?? "fill";
  const [width, setWidth] = useState<number | "fill">(initial);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const active = presets.find((p) => p.width === width)?.label ?? "";

  function resizeTo(next: number) {
    setWidth(Math.max(MIN_FRAME_WIDTH, Math.round(next)));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, width: actual };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    resizeTo(drag.current.width + (event.clientX - drag.current.x));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === "ArrowRight" ? KEY_STEP : event.key === "ArrowLeft" ? -KEY_STEP : 0;
    if (!delta) return;
    event.preventDefault();
    resizeTo(actual + delta);
  }

  return (
    <div className="os-rframe">
      <div className="os-rframe-bar">
        <SegmentedControl
          label="Preview width"
          size="sm"
          value={active}
          onChange={(value) => setWidth(presets.find((p) => p.label === value)?.width ?? "fill")}
        >
          {presets.map((preset) => (
            <SegmentedControlItem key={preset.label} value={preset.label} label={preset.label} />
          ))}
        </SegmentedControl>
        <Text type="supporting" color="secondary" hasTabularNumbers>
          {actual ? `${actual}px · ${tierFor(actual, "container")}` : ""}
        </Text>
      </div>
      <div className="os-rframe-stage">
        <div
          className={width === "fill" ? "os-rframe-viewport os-rframe-fill" : "os-rframe-viewport"}
          style={width === "fill" ? undefined : { width: `calc(${width}px + 2 * var(--os-rframe-pad))` }}
          role="group"
          aria-label={label}
        >
          <div ref={contentRef} className="os-rframe-content os-responsive-container">
            {children}
          </div>
        </div>
        <div
          className="os-rframe-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize preview"
          aria-valuenow={actual}
          aria-valuemin={MIN_FRAME_WIDTH}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}
