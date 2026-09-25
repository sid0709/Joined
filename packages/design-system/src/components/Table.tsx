"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button, IconButton } from "./Action";
import { Glyph, icons } from "./Glyph";
import { Icon } from "./Primitives";
import { useControllable } from "./hooks";

export type SortDirection = "asc" | "desc";

export interface TableSort {
  key: string;
  direction: SortDirection;
}

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  align?: "start" | "center" | "end";
  width?: number | string;
  sortable?: boolean;
  /** What sorting compares when the cell renders something richer than its value. */
  sortValue?: (row: T) => string | number;
  render?: (row: T) => ReactNode;
}

/**
 * card  — a bordered surface with rounded corners; the default.
 * plain — no outer chrome, for tables inside a card you already have.
 * lined — hairlines between columns as well as rows.
 */
export type TableVariant = "card" | "plain" | "lined";
export type TableSelection = "none" | "single" | "multiple";
export type TableDensity = "compact" | "regular" | "spacious";

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey?: (row: T) => string;
  variant?: TableVariant;
  density?: TableDensity;
  striped?: boolean;
  /** Keeps the header visible while the body scrolls inside `maxHeight`. */
  stickyHeader?: boolean;
  maxHeight?: number | string;
  sort?: TableSort | null;
  defaultSort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  selection?: TableSelection;
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  onRowClick?: (row: T) => void;
  /** Splits rows into pages and adds a footer to move between them. */
  pageSize?: number;
  loading?: boolean;
  empty?: ReactNode;
  /** A title and actions row inside the table surface. */
  header?: ReactNode;
  /** Accessible name. */
  caption?: string;
}

const SKELETON_ROWS = 3;

function compare(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function Check({ checked, mixed, label, onChange }: { checked: boolean; mixed?: boolean; label: string; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(mixed);
  }, [mixed]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="os-table-check"
      aria-label={label}
      checked={checked}
      onChange={onChange}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

/** Rows and columns that sort, select, page, and load — one data shape for all of it. */
export function Table<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  variant = "card",
  density = "regular",
  striped = false,
  stickyHeader = false,
  maxHeight,
  sort: sortProp,
  defaultSort = null,
  onSortChange,
  selection = "none",
  selectedKeys: selectedProp,
  defaultSelectedKeys = [],
  onSelectionChange,
  onRowClick,
  pageSize,
  loading = false,
  empty = "Nothing here yet.",
  header,
  caption,
}: TableProps<T>) {
  const [sort, setSort] = useControllable<TableSort | null>(sortProp, defaultSort, onSortChange);
  const [selected, setSelected] = useControllable(selectedProp, defaultSelectedKeys, onSelectionChange);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const withKeys = rows.map((row, index) => ({ row, key: rowKey?.(row) ?? String(index) }));
    if (!sort) return withKeys;
    const column = columns.find((c) => String(c.key) === sort.key);
    if (!column) return withKeys;
    const read = column.sortValue ?? ((row: T) => row[column.key as keyof T] as string | number);
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...withKeys].sort((a, b) => compare(read(a.row), read(b.row)) * factor);
  }, [rows, rowKey, columns, sort]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, pageCount - 1);
  const shown = pageSize ? sorted.slice(current * pageSize, current * pageSize + pageSize) : sorted;
  const selectedSet = new Set(selected);
  const allKeys = sorted.map((entry) => entry.key);
  const onCount = allKeys.filter((key) => selectedSet.has(key)).length;
  const multiple = selection === "multiple";
  const span = columns.length + (multiple ? 1 : 0);

  function cycleSort(key: string) {
    if (sort?.key !== key) setSort({ key, direction: "asc" });
    else if (sort.direction === "asc") setSort({ key, direction: "desc" });
    else setSort(null);
  }

  function toggleRow(key: string) {
    if (selection === "single") setSelected(selectedSet.has(key) ? [] : [key]);
    else setSelected(selectedSet.has(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  function toggleAll() {
    setSelected(onCount === allKeys.length ? [] : allKeys);
  }

  const wrapStyle: CSSProperties | undefined = maxHeight != null ? { maxHeight } : undefined;

  return (
    <div
      className={[
        "os-dt",
        `os-dt-${variant}`,
        `os-dt-${density}`,
        striped && "os-dt-striped",
        stickyHeader && "os-dt-sticky",
        selection !== "none" && "os-dt-selectable",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {header && <div className="os-dt-header">{header}</div>}
      <div className="os-dt-scroll" style={wrapStyle}>
        <table className="os-dt-table" aria-label={caption} aria-busy={loading || undefined}>
          <thead>
            <tr>
              {multiple && (
                <th className="os-dt-select" scope="col">
                  <Check
                    label="Select all rows"
                    checked={allKeys.length > 0 && onCount === allKeys.length}
                    mixed={onCount > 0 && onCount < allKeys.length}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((c) => {
                const key = String(c.key);
                const active = sort?.key === key;
                const ariaSort = active ? (sort!.direction === "asc" ? "ascending" : "descending") : undefined;
                return (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={`os-dt-align-${c.align ?? "start"}`}
                    style={c.width != null ? { width: c.width } : undefined}
                  >
                    {c.sortable ? (
                      <button type="button" className={active ? "os-dt-sort os-dt-sort-on" : "os-dt-sort"} onClick={() => cycleSort(key)}>
                        <span>{c.header}</span>
                        <Glyph name={active ? (sort!.direction === "asc" ? "arrowUp" : "arrowDown") : "sort"} />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: pageSize ?? SKELETON_ROWS }, (_, i) => (
                <tr key={`skeleton-${i}`} className="os-dt-loading">
                  {Array.from({ length: span }, (_, j) => (
                    <td key={j}>
                      <span className="os-dt-skeleton" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && shown.length === 0 && (
              <tr>
                <td className="os-dt-empty" colSpan={span}>
                  {empty}
                </td>
              </tr>
            )}
            {!loading &&
              shown.map(({ row, key }) => {
                const isSelected = selectedSet.has(key);
                const interactive = selection === "single" || Boolean(onRowClick);
                return (
                  <tr
                    key={key}
                    aria-selected={selection !== "none" ? isSelected : undefined}
                    className={isSelected ? "os-dt-row-selected" : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    onClick={
                      interactive || multiple
                        ? () => {
                            if (selection !== "none") toggleRow(key);
                            onRowClick?.(row);
                          }
                        : undefined
                    }
                    onKeyDown={
                      interactive
                        ? (event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            if (selection !== "none") toggleRow(key);
                            onRowClick?.(row);
                          }
                        : undefined
                    }
                  >
                    {multiple && (
                      <td className="os-dt-select">
                        <Check label={`Select row ${key}`} checked={isSelected} onChange={() => toggleRow(key)} />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={String(c.key)} className={`os-dt-align-${c.align ?? "start"}`}>
                        {c.render ? c.render(row) : String(row[c.key as keyof T] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {(pageSize || (multiple && onCount > 0)) && !loading && sorted.length > 0 && (
        <div className="os-dt-footer">
          <span className="os-dt-summary">
            {multiple && onCount > 0
              ? `${onCount} of ${sorted.length} selected`
              : pageSize
                ? `${current * pageSize + 1}–${Math.min((current + 1) * pageSize, sorted.length)} of ${sorted.length}`
                : null}
          </span>
          {pageSize && pageCount > 1 && (
            <div className="os-dt-pager">
              <IconButton
                label="Previous page"
                variant="ghost"
                size="sm"
                icon={<Icon icon={icons.chevronLeft} />}
                isDisabled={current === 0}
                onClick={() => setPage(current - 1)}
              />
              {Array.from({ length: pageCount }, (_, i) => (
                <Button
                  key={i}
                  label={`Page ${i + 1}`}
                  variant={i === current ? "secondary" : "ghost"}
                  size="sm"
                  aria-current={i === current ? "page" : undefined}
                  onClick={() => setPage(i)}
                >
                  {i + 1}
                </Button>
              ))}
              <IconButton
                label="Next page"
                variant="ghost"
                size="sm"
                icon={<Icon icon={icons.chevronRight} />}
                isDisabled={current === pageCount - 1}
                onClick={() => setPage(current + 1)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
