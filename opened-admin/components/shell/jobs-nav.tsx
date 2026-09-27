"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { jobsNav } from "@/lib/nav";

export function JobsNav({ horizontal = false }: { horizontal?: boolean }) {
  const pathname = usePathname();

  if (horizontal) {
    return (
      <nav aria-label="Jobs" className="flex gap-2">
        {jobsNav.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            active={isActive(pathname, item.href)}
            compact
          />
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Jobs">
      <p className="px-2 text-[11px] font-medium tracking-[0.14em] text-sidebar-muted">JOBS</p>
      <ul className="mt-2 space-y-1">
        {jobsNav.map((item) => (
          <li key={item.href}>
            <NavLink href={item.href} label={item.label} active={isActive(pathname, item.href)} />
          </li>
        ))}
      </ul>
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

function isActive(pathname: string, href: string) {
  return pathname === href;
}
