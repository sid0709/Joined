"use client";

import { usePathname } from "next/navigation";
import { Badge, Icon, SideNav, SideNavItem, SideNavSection, Stack, Text, icons } from "sid-ui";
import { BRAND } from "@/lib/config";
import { CONSOLE_NAV, activeHref, type NavLink } from "@/lib/nav";

export type NavCounts = Partial<Record<NonNullable<NavLink["badge"]>, number>>;

/** Staff sections, with live counts on the queues that need attention. */
export function ConsoleNav({ counts }: { counts: NavCounts }) {
  const pathname = usePathname();
  const active = activeHref(pathname);
  return (
    <SideNav
      header={
        <Stack gap={0.5}>
          <Text weight="semibold">{BRAND}</Text>
          <Text type="supporting" color="secondary">
            Staff console
          </Text>
        </Stack>
      }
    >
      {CONSOLE_NAV.map((group) => (
        <SideNavSection key={group.title} title={group.title}>
          {group.links.map((link) => {
            const count = link.badge ? (counts[link.badge] ?? 0) : 0;
            return (
              <SideNavItem
                key={link.href}
                label={link.label}
                href={link.href}
                icon={<Icon icon={icons[link.icon]} />}
                isSelected={link.href === active}
                endContent={
                  count > 0 ? <Badge label={String(count)} variant="warning" /> : undefined
                }
              />
            );
          })}
        </SideNavSection>
      ))}
    </SideNav>
  );
}
