import { Glyph } from "@openseat/design-system";
import Link from "next/link";

import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: { href: string; label: string };
  meta?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions, back, meta }: PageHeaderProps) {
  return (
    <header className="hx-header">
      <div className="hx-header-main">
        {back && (
          <Link href={back.href} className="hx-back">
            <Glyph name="arrowLeft" /> {back.label}
          </Link>
        )}
        <span className="hx-eyebrow">{eyebrow}</span>
        <h1 className="hx-title">{title}</h1>
        {description && <p className="hx-lede">{description}</p>}
        {meta}
      </div>
      {actions && <div className="hx-header-actions">{actions}</div>}
    </header>
  );
}
