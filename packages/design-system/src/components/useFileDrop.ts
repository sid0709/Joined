"use client";

import { useCallback, useRef, useState, type ClipboardEvent, type DragEvent } from "react";

export interface UseFileDropOptions {
  onFiles: (files: File[]) => void;
  isDisabled?: boolean;
  /** Also accept files pasted from the clipboard while focus is inside the target. */
  hasPaste?: boolean;
}

export interface FileDropProps {
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onPaste?: (event: ClipboardEvent<HTMLElement>) => void;
}

function carriesFiles(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/**
 * Turns any element into a file drop target. Spread `dropProps` on it and use
 * `isDragging` to show a drop state. Nested children don't flicker the state.
 */
export function useFileDrop({ onFiles, isDisabled = false, hasPaste = false }: UseFileDropOptions) {
  const [isDragging, setDragging] = useState(false);
  const depth = useRef(0);

  const reset = useCallback(() => {
    depth.current = 0;
    setDragging(false);
  }, []);

  const dropProps: FileDropProps = {
    onDragEnter: (event) => {
      if (isDisabled || !carriesFiles(event)) return;
      event.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver: (event) => {
      if (isDisabled || !carriesFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: () => {
      if (isDisabled) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop: (event) => {
      if (isDisabled) return;
      event.preventDefault();
      reset();
      const files: File[] = Array.from(event.dataTransfer.files as ArrayLike<File>);
      if (files.length) onFiles(files);
    },
  };

  if (hasPaste) {
    dropProps.onPaste = (event) => {
      if (isDisabled) return;
      const files: File[] = Array.from(event.clipboardData.files as ArrayLike<File>);
      if (!files.length) return;
      event.preventDefault();
      onFiles(files);
    };
  }

  return { isDragging, dropProps };
}

const KB = 1024;
const UNITS = ["B", "KB", "MB", "GB"];

/** 1536 → "1.5 KB". */
export function formatBytes(bytes: number) {
  let value = bytes;
  let unit = 0;
  while (value >= KB && unit < UNITS.length - 1) {
    value /= KB;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${UNITS[unit]}`;
}

/** Matches a file against an `accept` string such as ".pdf,image/*". */
export function matchesAccept(file: File, accept?: string) {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .some((token) => {
      if (token.startsWith(".")) return name.endsWith(token);
      if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
      return type === token;
    });
}
