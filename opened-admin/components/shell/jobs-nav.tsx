"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { consoleNav } from "@/lib/nav";

const navItems = consoleNav.flatMap((group) => [...group.items]);

export function JobsNav({ horizontal = false }: { horizontal?: boolean }) {
  const pathname = usePathname();

  if (horizontal) {
    return (
      <nav aria-label="Admin" className="flex gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            active={pathname === item.href}
            compact
          />
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Admin" className="flex flex-col gap-6">
      {consoleNav.map((group) => (
        <div key={group.label}>
          <p className="px-2 text-[11px] font-medium tracking-[0.14em] text-sidebar-muted">
            {group.label.toUpperCase()}
          </p>
          <ul className="mt-2 space-y-1">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} label={item.label} active={pathname === item.href} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavLink({
  href,
  label,
  active,
  compact = false,
}: {
  href: string;
  label: string;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        compact
          ? `rounded-full px-3 py-1 text-sm ${active ? "bg-ink text-surface" : "text-muted"}`
          : `block rounded-lg px-2 py-1.5 text-sm ${active ? "bg-white/10 text-surface" : "text-sidebar-muted hover:text-surface"}`
      }
    >
      {label}
    </Link>
  );
}
