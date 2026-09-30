"use client";

import {
  useId,
  useRef,
  type ClipboardEvent,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import {
  deleteCode,
  insertCode,
  typedCharacters,
  type CodeCharset,
  type CodeEdit,
} from "./codeInputRules";

import type { ControlSize } from "./size";

export const CODE_INPUT_LENGTH = 6;

export type CodeInputStatus = "default" | "error" | "success";

export interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called once, when the last cell is filled. */
  onComplete?: (value: string) => void;
  length?: number;
  /** Digits only by default; `alphanumeric` also accepts letters (shown upper-case). */
  charset?: CodeCharset;
  label: string;
  isLabelHidden?: boolean;
  description?: string;
  /** `error` shakes the cells once and turns them red; `success` ripples green across them. */
  status?: CodeInputStatus;
  isDisabled?: boolean;
  hasAutoFocus?: boolean;
  size?: ControlSize;
}

/** One round cell per character. Typing, pasting, backspace, and arrow keys move between cells. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  length = CODE_INPUT_LENGTH,
  charset = "numeric",
  label,
  isLabelHidden = false,
  description,
  status = "default",
  isDisabled = false,
  hasAutoFocus = false,
  size = "md",
}: CodeInputProps) {
  const id = useId();
  const cells = useRef<Array<HTMLInputElement | null>>([]);
  // Focus moves before React re-renders, so handlers read the newest value from here.
  const latest = useRef(value);
  latest.current = value;

  const focusCell = (index: number) => {
    const cell = cells.current[Math.max(0, Math.min(index, length - 1))];
    cell?.focus();
    cell?.select();
  };

  const apply = ({ value: next, focusIndex }: CodeEdit) => {
    if (next !== latest.current) {
      latest.current = next;
      onChange(next);
      if (next.length === length) onComplete?.(next);
    }
    focusCell(focusIndex);
  };

  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const current = latest.current;
    const typed = typedCharacters(event.target.value, current[index]);
    if (!typed) {
      apply(deleteCode(current, index));
      return;
    }
    apply(insertCode(current, index, typed, length, charset));
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    const current = latest.current;
    switch (event.key) {
      case "Backspace":
        event.preventDefault();
        apply(deleteCode(current, index));
        break;
      case "Delete":
        event.preventDefault();
        if (index < current.length) apply(deleteCode(current, index));
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusCell(index - 1);
        break;
      case "ArrowRight":
        event.preventDefault();
        focusCell(Math.min(index + 1, current.length));
        break;
      case "Home":
        event.preventDefault();
        focusCell(0);
        break;
      case "End":
        event.preventDefault();
        focusCell(current.length);
        break;
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    apply(insertCode(latest.current, index, event.clipboardData.getData("text"), length, charset));
  };

  return (
    <div
      className={`os-code os-code-${size}`}
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={description ? `${id}-description` : undefined}
      data-status={status}
    >
      <span
        id={`${id}-label`}
        className={isLabelHidden ? "os-code-label os-code-label-hidden" : "os-code-label"}
      >
        {label}
      </span>
      <div className="os-code-cells">
        {Array.from({ length }, (_, index) => {
          const character = value[index] ?? "";
          return (
            <div
              key={index}
              className="os-code-cell"
              data-filled={character ? "true" : "false"}
              style={{ "--os-code-index": index } as CSSProperties}
            >
              <input
                ref={(node) => {
                  cells.current[index] = node;
                }}
                className="os-code-input"
                value={character}
                onChange={(event) => handleChange(index, event)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={(event) => handlePaste(index, event)}
                onFocus={(event) => {
                  // Reaching a cell past the end lands on the first empty one.
                  if (index > latest.current.length) focusCell(latest.current.length);
                  else event.target.select();
                }}
                inputMode={charset === "numeric" ? "numeric" : "text"}
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                aria-label={`${label}, character ${index + 1} of ${length}`}
                aria-invalid={status === "error" || undefined}
                disabled={isDisabled}
                autoFocus={hasAutoFocus && index === 0}
              />
            </div>
          );
        })}
      </div>
      {description ? (
        <span id={`${id}-description`} className="os-code-description">
          {description}
        </span>
      ) : null}
    </div>
  );
}
