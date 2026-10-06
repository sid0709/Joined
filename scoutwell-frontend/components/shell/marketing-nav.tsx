"use client";

import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu, TopNavItem, useAppShellMobile, type DropdownMenuOption } from "sid-ui";
import { MARKETING_PAGES, activeHref } from "@/lib/nav";

/** How it works, Earn, Install, and FAQ — pills on wide screens, a menu on small ones. */
export function MarketingNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile } = useAppShellMobile();
  const current = activeHref(pathname, MARKETING_PAGES);

  if (isMobile) {
    const items: DropdownMenuOption[] = MARKETING_PAGES.map((page) => ({
      id: page.href,
      label: page.label,
      onClick: () => router.push(page.href),
    }));
    return (
      <DropdownMenu
        button={{ label: "Menu", variant: "ghost", size: "sm" }}
        hasChevron
        alignment="start"
        items={items}
      />
    );
  }

  return (
    <>
      {MARKETING_PAGES.map((page) => (
        <TopNavItem
          key={page.href}
          label={page.label}
          href={page.href}
          isSelected={current === page.href}
        />
      ))}
    </>
  );
}
