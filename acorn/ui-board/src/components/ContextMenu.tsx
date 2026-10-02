import { useEffect, useRef } from "react";
import "./ContextMenu.css";

export interface ContextMenuState {
  x: number;
  y: number;
  nodeLabel: string;
}

interface Props {
  menu: ContextMenuState | null;
  onClose: () => void;
  onGetInnerHtml: () => void;
  onGetInnerText: () => void;
  onAction: () => void;
}

export function ContextMenu({ menu, onClose, onGetInnerHtml, onGetInnerText, onAction }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ top: menu.y, left: menu.x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="context-menu-header">{menu.nodeLabel}</div>
      <button type="button" onClick={onGetInnerHtml}>
        Get Element HTML
      </button>
      <button type="button" onClick={onGetInnerText}>
        Get Inner Text
      </button>
      <button type="button" onClick={onAction}>
        Action…
      </button>
    </div>
  );
}
