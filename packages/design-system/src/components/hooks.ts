"use client";

import { useEffect, useState, type RefObject } from "react";

/** Calls `onDismiss` on a pointer-down outside `ref` or on Escape while `active`. */
export function useDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!active) return;
    function onPointer(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, active, onDismiss]);
}

/** Current time, refreshed every `intervalMs`. `null` until mounted so SSR output stays stable. */
export function useNow(intervalMs: number, enabled = true) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    if (!enabled) return;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}

/** Internal state that defers to `controlled` when the caller passes one. */
export function useControllable<T>(controlled: T | undefined, initial: T, onChange?: (value: T) => void) {
  const [inner, setInner] = useState<T>(initial);
  const value = controlled !== undefined ? controlled : inner;
  function set(next: T) {
    if (controlled === undefined) setInner(next);
    onChange?.(next);
  }
  return [value, set] as const;
}
