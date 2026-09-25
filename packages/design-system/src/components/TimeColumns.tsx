"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import type { ControlSize } from "./size";
import {
  HOURS_PER_HALF,
  MERIDIEMS,
  MINUTES_PER_HOUR,
  from12,
  formatTime,
  meridiemOf,
  pad2,
  parseTime,
  range,
  to12,
  type HourCycle,
  type MinuteStep,
} from "./time";

export interface TimeColumnsProps {
  value: string;
  onChange?: (value: string) => void;
  hourCycle?: HourCycle;
  withSeconds?: boolean;
  minuteStep?: MinuteStep;
  size?: ControlSize;
  disabled?: boolean;
}

interface ColumnProps<T extends string | number> {
  label: string;
  options: T[];
  selected: T | null;
  render: (option: T) => string;
  onSelect: (option: T) => void;
  disabled?: boolean;
}

function Column<T extends string | number>({ label, options, selected, render, onSelect, disabled }: ColumnProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const on = list?.querySelector<HTMLElement>("[aria-selected='true']");
    if (!list || !on) return;
    list.scrollTo({ top: on.offsetTop - list.clientHeight / 2 + on.clientHeight / 2, behavior: "smooth" });
  }, [selected]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const index = selected == null ? -1 : options.indexOf(selected);
    onSelect(options[(index + delta + options.length) % options.length]);
  }

  return (
    <div
      ref={listRef}
      className="os-tcol"
      role="listbox"
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={disabled ? undefined : onKeyDown}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="option"
          tabIndex={-1}
          aria-selected={option === selected}
          className="os-tcol-option"
          disabled={disabled}
          onClick={() => onSelect(option)}
        >
          {render(option)}
        </button>
      ))}
    </div>
  );
}

/** Scrolling columns, one per unit — the dropdown picker behind TimeField. */
export function TimeColumns({
  value,
  onChange,
  hourCycle = "12h",
  withSeconds = false,
  minuteStep = 5,
  size = "md",
  disabled,
}: TimeColumnsProps) {
  const parts = parseTime(value);
  const h = parts?.h ?? null;
  const twelve = hourCycle === "12h";
  const base = parts ?? { h: 0, m: 0, s: 0 };

  function commit(next: Partial<typeof base>) {
    onChange?.(formatTime({ ...base, ...next }, withSeconds));
  }

  return (
    <div className={`os-tcols os-tcols-${size}`}>
      <Column
        label="Hour"
        options={twelve ? range(1, HOURS_PER_HALF) : range(0, 23)}
        selected={h == null ? null : twelve ? to12(h) : h}
        render={twelve ? String : pad2}
        disabled={disabled}
        onSelect={(hour) => commit({ h: twelve ? from12(hour, meridiemOf(base.h)) : hour })}
      />
      <Column
        label="Minute"
        options={range(0, MINUTES_PER_HOUR - 1, minuteStep)}
        selected={parts?.m ?? null}
        render={pad2}
        disabled={disabled}
        onSelect={(m) => commit({ m })}
      />
      {withSeconds && (
        <Column
          label="Second"
          options={range(0, MINUTES_PER_HOUR - 1)}
          selected={parts?.s ?? null}
          render={pad2}
          disabled={disabled}
          onSelect={(s) => commit({ s })}
        />
      )}
      {twelve && (
        <Column
          label="AM or PM"
          options={[...MERIDIEMS]}
          selected={h == null ? null : meridiemOf(h)}
          render={String}
          disabled={disabled}
          onSelect={(meridiem) => commit({ h: from12(to12(base.h), meridiem) })}
        />
      )}
    </div>
  );
}
