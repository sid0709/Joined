import type { ReactNode } from "react";

interface PanelProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Remove body padding — for tables and lists that own their spacing. */
  flush?: boolean;
  tinted?: boolean;
  className?: string;
  children: ReactNode;
}

export function Panel({
  title,
  subtitle,
  actions,
  flush,
  tinted,
  className,
  children,
}: PanelProps) {
  return (
    <section
      className={["hx-panel", tinted && "hx-panel-tinted", className].filter(Boolean).join(" ")}
    >
      {(title || actions) && (
        <div className="hx-panel-head">
          <div>
            {title && <h2 className="hx-panel-title">{title}</h2>}
            {subtitle && <p className="hx-panel-sub">{subtitle}</p>}
          </div>
          {actions && <div className="hx-row">{actions}</div>}
        </div>
      )}
      <div className={flush ? undefined : "hx-panel-body"}>{children}</div>
    </section>
  );
}
