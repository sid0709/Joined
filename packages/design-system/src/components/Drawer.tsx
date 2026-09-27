"use client";

import { Layout, LayoutContent, LayoutFooter } from "./LayoutPrimitives";
import { Dialog, DialogHeader, type DialogPurpose } from "./Overlay";

import type { CSSProperties, ReactNode } from "react";

export type DrawerSide = "start" | "end" | "top" | "bottom";
export type DrawerSize = "sm" | "md" | "lg" | "full";

/** Panel length along the drawer's axis: width for start/end, height for top/bottom. */
const LENGTH: Record<Exclude<DrawerSize, "full">, number> = { sm: 360, md: 480, lg: 720 };
const FULL = "100%";

/** Flush to the viewport. A radius leaves a crescent of the scrim in each corner. */
const FLUSH = { borderRadius: 0, "--_dialog-radius": "0px" } as CSSProperties;

export interface DrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Sticky actions at the bottom — Save, Cancel, Next. */
  footer?: ReactNode;
  /** Actions beside the title, before the close button. */
  headerActions?: ReactNode;
  /** Leading content in the header — an avatar or icon. */
  headerStart?: ReactNode;
  /** Which edge the drawer slides from. Logical start/end mirror under RTL. */
  side?: DrawerSide;
  /** sm 360, md 480, lg 720, full — or any px/CSS length. */
  size?: number | string;
  /**
   * form keeps focus inside and guards against losing input; info closes on
   * outside click; required must be answered.
   */
  purpose?: DialogPurpose;
  /** Renders in place instead of on the top layer — for docs and embedded previews. */
  isInline?: boolean;
}

function lengthOf(size: DrawerProps["size"]) {
  if (size === undefined) return LENGTH.md;
  if (size === "full") return FULL;
  if (typeof size === "string" && size in LENGTH) return LENGTH[size as keyof typeof LENGTH];
  return size;
}

/**
 * A panel that slides in from an edge for detail, editing, or filters while the
 * page stays in context. Built on Astryx Dialog, so focus, Escape, and the
 * scrim behave like every other overlay.
 */
export function Drawer({
  isOpen,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
  headerActions,
  headerStart,
  side = "end",
  size = "md",
  purpose = "info",
  isInline,
}: DrawerProps) {
  const horizontal = side === "start" || side === "end";
  const length = lengthOf(size);
  const position = {
    start: { start: 0, top: 0, bottom: 0 },
    end: { end: 0, top: 0, bottom: 0 },
    top: { top: 0, start: 0, end: 0 },
    bottom: { bottom: 0, start: 0, end: 0 },
  }[side];

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isInline={isInline}
      purpose={purpose}
      position={position}
      width={horizontal ? length : FULL}
      maxHeight={horizontal ? FULL : length}
      style={
        horizontal
          ? { height: FULL, maxWidth: FULL, ...FLUSH }
          : { height: length, width: FULL, maxWidth: FULL, ...FLUSH }
      }
    >
      <Layout
        height="fill"
        header={
          <DialogHeader
            title={title}
            subtitle={subtitle}
            startContent={headerStart}
            endContent={headerActions}
            onOpenChange={onOpenChange}
            hasDivider
          />
        }
        content={<LayoutContent>{children}</LayoutContent>}
        footer={footer ? <LayoutFooter hasDivider>{footer}</LayoutFooter> : undefined}
      />
    </Dialog>
  );
}
