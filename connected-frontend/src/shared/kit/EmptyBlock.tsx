import { Glyph, type GlyphName } from "sid-ui";

import type { ReactNode } from "react";

interface EmptyBlockProps {
  icon: GlyphName;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyBlock({ icon, title, description, action }: EmptyBlockProps) {
  return (
    <div className="hx-empty">
      <span className="hx-empty-icon">
        <Glyph name={icon} size="1.4em" />
      </span>
      <strong className="hx-strong" style={{ color: "var(--color-text-primary)" }}>
        {title}
      </strong>
      <span>{description}</span>
      {action}
    </div>
  );
}
