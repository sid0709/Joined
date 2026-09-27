"use client";

import { useEffect, useRef, type RefObject } from "react";

const TYPING = "input, textarea, select, [contenteditable='true']";
const NEXT_KEYS = new Set(["j"]);
const PREV_KEYS = new Set(["k"]);
const SAVE_KEY = "s";
const SEARCH_KEY = "/";

type Options = {
  ids: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSave: (id: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
};

function isTyping(target: EventTarget | null) {
  return target instanceof Element && target.closest(TYPING) !== null;
}

/** Brings the selected result card into view inside the list. */
function reveal(id: string) {
  document.querySelector(`[data-job-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
}

/**
 * Inbox-style keys for the result list: J/K to move, S to save,
 * / to jump to search. Ignored while typing or when a dialog is open.
 */
export function useJobKeyboard({ ids, selectedId, onSelect, onSave, searchRef }: Options) {
  const latest = useRef({ ids, selectedId, onSelect, onSave });
  useEffect(() => {
    latest.current = { ids, selectedId, onSelect, onSave };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (isTyping(event.target) || document.querySelector("dialog[open]")) return;
      const { ids: list, selectedId: current, onSelect: select, onSave: save } = latest.current;

      if (event.key === SEARCH_KEY) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === SAVE_KEY && current) {
        event.preventDefault();
        save(current);
        return;
      }
      const step = NEXT_KEYS.has(event.key) ? 1 : PREV_KEYS.has(event.key) ? -1 : 0;
      if (step === 0 || list.length === 0) return;
      event.preventDefault();
      const index = current ? list.indexOf(current) : -1;
      const next = list[Math.min(Math.max(index + step, 0), list.length - 1)];
      select(next);
      reveal(next);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchRef]);
}
