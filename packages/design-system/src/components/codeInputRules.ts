/** Pure editing rules for CodeInput, kept apart from React so they can be tested. */

export type CodeCharset = "numeric" | "alphanumeric";

export interface CodeEdit {
  value: string;
  /** The cell that should hold focus after the edit. */
  focusIndex: number;
}

const CHARSET_PATTERN: Record<CodeCharset, RegExp> = {
  numeric: /[^0-9]/g,
  alphanumeric: /[^a-z0-9]/gi,
};

/** Drops characters the code does not allow, so a pasted "123 456" still works. */
export function sanitizeCode(raw: string, charset: CodeCharset = "numeric") {
  const cleaned = raw.replace(CHARSET_PATTERN[charset], "");
  return charset === "alphanumeric" ? cleaned.toUpperCase() : cleaned;
}

/**
 * Types or pastes `raw` into the cell at `index`. The value stays contiguous, so a cell past the
 * end of the value writes at the end. A full-length paste replaces the whole code.
 */
export function insertCode(
  value: string,
  index: number,
  raw: string,
  length: number,
  charset: CodeCharset = "numeric",
): CodeEdit {
  const chars = sanitizeCode(raw, charset);
  if (!chars) return { value, focusIndex: Math.min(index, length - 1) };

  const start = chars.length >= length ? 0 : Math.min(index, value.length);
  const next = (value.slice(0, start) + chars + value.slice(start + chars.length)).slice(0, length);
  return { value: next, focusIndex: Math.min(start + chars.length, length - 1) };
}

/** Backspace: clears the focused cell, or, when it is empty, the one before it. */
export function deleteCode(value: string, index: number): CodeEdit {
  if (index < value.length) {
    return { value: value.slice(0, index) + value.slice(index + 1), focusIndex: index };
  }
  const previous = Math.max(value.length - 1, 0);
  return { value: value.slice(0, previous), focusIndex: previous };
}

/**
 * A cell's `onChange` gives its whole text. When the cell already held a character and the browser
 * kept it, what remains after removing that character is what was typed.
 */
export function typedCharacters(raw: string, previous: string | undefined) {
  if (!previous || raw.length <= 1) return raw;
  const at = raw.indexOf(previous);
  return at === -1 ? raw : raw.slice(0, at) + raw.slice(at + previous.length);
}
