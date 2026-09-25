"use client";

import type { ReactNode } from "react";
import { Tree, type TreeNode } from "./Tree";

/** The two-level shorthand for Tree — every branch starts open. */
export function TreeList({
  items,
}: {
  items: { label: string; children?: { label: string }[] }[];
}) {
  const nodes: TreeNode[] = items.map((item) => ({
    id: item.label,
    label: item.label,
    children: item.children?.map((child) => ({ id: `${item.label}/${child.label}`, label: child.label })),
  }));
  return <Tree nodes={nodes} variant="guides" defaultExpanded={nodes.map((node) => node.id)} />;
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="os-page-body">{children}</div>;
}

export function PageHero({ children }: { children: ReactNode }) {
  return <div className="os-page-hero">{children}</div>;
}

export function Preview({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="os-preview">
      <div className="os-preview-stage">{children}</div>
      {label && <p className="caption os-preview-label">{label}</p>}
    </div>
  );
}

export function PreviewGrid({ children }: { children: ReactNode }) {
  return <div className="os-preview-grid">{children}</div>;
}
