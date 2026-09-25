"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Glyph } from "./Glyph";
import { useControllable } from "./hooks";

export interface TreeNode {
  id: string;
  label: string;
  description?: string;
  /** Trailing content — a count, a badge, a status. */
  meta?: ReactNode;
  /** Icon or avatar before the label. Explorer shows folder and file icons when this is empty. */
  leading?: ReactNode;
  disabled?: boolean;
  children?: TreeNode[];
}

/**
 * guides    — indent lines connect every level.
 * explorer  — folders and files; guides appear on hover.
 * cards     — each top-level branch on its own surface.
 * selection — one chosen row with an accent bar.
 * checkbox  — tri-state checks that roll up to parents.
 */
export type TreeVariant = "guides" | "explorer" | "cards" | "selection" | "checkbox";
export type TreeCheckState = "checked" | "unchecked" | "mixed";

export interface TreeProps {
  nodes: TreeNode[];
  variant?: TreeVariant;
  density?: "compact" | "regular" | "spacious";
  /** Open branch ids. Pass `expanded` to control it, or `defaultExpanded` to seed it. */
  expanded?: string[];
  defaultExpanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** Checked leaf ids for `variant="checkbox"`. Parents derive their state. */
  checked?: string[];
  defaultChecked?: string[];
  onCheckedChange?: (ids: string[]) => void;
  /** Marks this text inside labels — pair it with a filter. */
  highlight?: string;
  label?: string;
}

interface Flat {
  node: TreeNode;
  depth: number;
  parent: string | null;
}

function leavesOf(node: TreeNode): string[] {
  if (!node.children?.length) return node.disabled ? [] : [node.id];
  return node.children.flatMap(leavesOf);
}

function Highlight({ text, query }: { text: string; query?: string }) {
  const q = query?.trim();
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (!q || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="os-tree-mark">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

/** A nested hierarchy. Arrow keys move, Right/Left open and close, Space checks or selects. */
export function Tree({
  nodes,
  variant = "guides",
  density = "regular",
  expanded: expandedProp,
  defaultExpanded = [],
  onExpandedChange,
  selectedId,
  onSelect,
  checked: checkedProp,
  defaultChecked = [],
  onCheckedChange,
  highlight,
  label = "Tree",
}: TreeProps) {
  const [expandedList, setExpandedList] = useControllable(expandedProp, defaultExpanded, onExpandedChange);
  const [checkedList, setCheckedList] = useControllable(checkedProp, defaultChecked, onCheckedChange);
  const expanded = useMemo(() => new Set(expandedList), [expandedList]);
  const checked = useMemo(() => new Set(checkedList), [checkedList]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());

  const visible = useMemo(() => {
    const out: Flat[] = [];
    const walk = (list: TreeNode[], depth: number, parent: string | null) => {
      for (const node of list) {
        out.push({ node, depth, parent });
        if (node.children?.length && expanded.has(node.id)) walk(node.children, depth + 1, node.id);
      }
    };
    walk(nodes, 0, null);
    return out;
  }, [nodes, expanded]);

  const tabStop = visible.some((row) => row.node.id === focusedId) ? focusedId : visible[0]?.node.id;

  function focus(id: string | undefined) {
    if (!id) return;
    setFocusedId(id);
    rows.current.get(id)?.focus();
  }

  function toggleOpen(id: string, open?: boolean) {
    const willOpen = open ?? !expanded.has(id);
    setExpandedList(willOpen ? [...expandedList, id] : expandedList.filter((x) => x !== id));
  }

  function checkState(node: TreeNode): TreeCheckState {
    const leaves = leavesOf(node);
    const on = leaves.filter((id) => checked.has(id)).length;
    return on === 0 ? "unchecked" : on === leaves.length ? "checked" : "mixed";
  }

  function toggleCheck(node: TreeNode) {
    const leaves = leavesOf(node);
    const next = new Set(checked);
    if (checkState(node) === "checked") leaves.forEach((id) => next.delete(id));
    else leaves.forEach((id) => next.add(id));
    setCheckedList([...next]);
  }

  function activate(node: TreeNode) {
    if (node.disabled) return;
    setFocusedId(node.id);
    if (variant === "checkbox") toggleCheck(node);
    else {
      onSelect?.(node.id);
      if (node.children?.length && variant !== "selection") toggleOpen(node.id);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLLIElement>, row: Flat, index: number) {
    if (event.target !== event.currentTarget) return;
    const { node } = row;
    const hasChildren = Boolean(node.children?.length);
    const open = expanded.has(node.id);
    const moves: Record<string, () => void> = {
      ArrowDown: () => focus(visible[index + 1]?.node.id),
      ArrowUp: () => focus(visible[index - 1]?.node.id),
      Home: () => focus(visible[0]?.node.id),
      End: () => focus(visible[visible.length - 1]?.node.id),
      ArrowRight: () => (hasChildren && !open ? toggleOpen(node.id, true) : hasChildren && focus(node.children![0].id)),
      ArrowLeft: () => (hasChildren && open ? toggleOpen(node.id, false) : focus(row.parent ?? undefined)),
      Enter: () => activate(node),
      " ": () => (variant === "checkbox" ? !node.disabled && toggleCheck(node) : activate(node)),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  }

  function renderBranch(list: TreeNode[], depth: number): ReactNode {
    return list.map((node) => {
      const index = visible.findIndex((row) => row.node.id === node.id);
      const row = visible[index];
      const hasChildren = Boolean(node.children?.length);
      const open = hasChildren && expanded.has(node.id);
      const selected = selectedId === node.id;
      const state = variant === "checkbox" ? checkState(node) : null;
      const icon =
        node.leading ?? (variant === "explorer" ? <Glyph name={hasChildren ? (open ? "folderOpen" : "folder") : "file"} /> : null);

      return (
        <li
          key={node.id}
          ref={(el) => {
            if (el) rows.current.set(node.id, el);
            else rows.current.delete(node.id);
          }}
          role="treeitem"
          className={["os-tree-item", depth === 0 && "os-tree-root"].filter(Boolean).join(" ")}
          aria-level={depth + 1}
          aria-expanded={hasChildren ? open : undefined}
          aria-selected={variant === "selection" ? selected : undefined}
          aria-checked={state ? (state === "mixed" ? "mixed" : state === "checked") : undefined}
          aria-disabled={node.disabled || undefined}
          tabIndex={tabStop === node.id ? 0 : -1}
          onFocus={(event) => event.target === event.currentTarget && setFocusedId(node.id)}
          onKeyDown={(event) => onKeyDown(event, row, index)}
        >
          <div
            className={["os-tree-row", selected && "os-tree-row-selected", node.disabled && "os-tree-row-disabled"].filter(Boolean).join(" ")}
            style={{ ["--os-tree-depth" as string]: depth }}
            onClick={() => activate(node)}
          >
            {Array.from({ length: depth }, (_, i) => (
              <span key={i} className="os-tree-indent" aria-hidden />
            ))}
            <span
              className={hasChildren ? "os-tree-chevron" : "os-tree-chevron os-tree-chevron-empty"}
              aria-hidden
              onClick={(event) => {
                if (!hasChildren || node.disabled) return;
                event.stopPropagation();
                setFocusedId(node.id);
                toggleOpen(node.id);
              }}
            >
              {hasChildren && <Glyph name="chevronRight" />}
            </span>
            {state && (
              <span className="os-tree-check" data-state={state} aria-hidden>
                {state === "checked" && <Glyph name="check" />}
                {state === "mixed" && <Glyph name="minus" />}
              </span>
            )}
            {icon && <span className={variant === "explorer" && !node.leading ? "os-tree-lead os-tree-icon" : "os-tree-lead"}>{icon}</span>}
            <span className="os-tree-text">
              <span className="os-tree-label">
                <Highlight text={node.label} query={highlight} />
              </span>
              {node.description && <span className="os-tree-desc">{node.description}</span>}
            </span>
            {node.meta != null && <span className="os-tree-meta">{node.meta}</span>}
          </div>
          {open && (
            <ul role="group" className="os-tree-group">
              {renderBranch(node.children!, depth + 1)}
            </ul>
          )}
        </li>
      );
    });
  }

  return (
    <ul
      role="tree"
      aria-label={label}
      aria-multiselectable={variant === "checkbox" || undefined}
      className={`os-tree os-tree-${variant} os-tree-${density}`}
    >
      {renderBranch(nodes, 0)}
    </ul>
  );
}
