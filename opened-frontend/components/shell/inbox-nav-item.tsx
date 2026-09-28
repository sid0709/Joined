"use client";

import { usePathname } from "next/navigation";
import { Badge, Icon, TopNavItem, VisuallyHidden, icons } from "@openseat/design-system";

/**
 * The inbox shortcut in a header: an icon with the unread count beside it.
 * Not `isIconOnly` — that drops children, and the count is the point.
 */
export function InboxNavItem({ href, unread }: { href: string; unread: number }) {
  const pathname = usePathname();
  const label = unread > 0 ? `Messages, ${unread} unread` : "Messages";
  return (
    <TopNavItem
      label={label}
      href={href}
      isSelected={pathname === href}
      icon={<Icon icon={icons.chat} />}
    >
      <VisuallyHidden>{label}</VisuallyHidden>
      {unread > 0 ? <Badge label={String(unread)} variant="info" /> : null}
    </TopNavItem>
  );
}
