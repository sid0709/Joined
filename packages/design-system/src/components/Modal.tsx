"use client";

import { ReactNode, useEffect, useId, useRef } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * A focused, blocking overlay for a single decision or short task. Always
 * give it a way out: the X, Escape, or a footer action.
 */
export function Modal({ open, onClose, title, children, footer, className = "" }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !dialog) return;

      const elements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="os-modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className={["os-modal", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Dialog"}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="os-modal-header">
            <p id={titleId} className="h3 os-modal-title">{title}</p>
            <button type="button" className="os-modal-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        )}
        <div className="os-modal-body">{children}</div>
        {footer && <div className="os-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/** Alias — OpenSeat names this pattern Dialog; same component. */
export const Dialog = Modal;
export type DialogProps = ModalProps;
