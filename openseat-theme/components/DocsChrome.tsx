"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell, Button, Icon, SideNav, SideNavHeading, SideNavItem, TextInput, TopNav, TopNavHeading, TopNavItem } from "@openseat/design-system";
import { CATALOG, itemHref } from "@/lib/catalog";
import { useColorMode } from "@/components/Providers";
import { ClientOnly } from "@/components/ClientOnly";

export function DocsChrome({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { mode, setMode } = useColorMode();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATALOG;
    return CATALOG.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
      ),
    })).filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <AppShell
      variant="elevated"
      contentPadding={6}
      topNav={
        <TopNav
          label="Documentation"
          heading={<TopNavHeading heading="OpenSeat" headingHref="/" />}
          startContent={
            <>
              <TopNavItem
                label="Components"
                href="/"
                isSelected={path === "/" || path.startsWith("/components")}
              />
              <TopNavItem label="Tokens" href="/tokens" isSelected={path === "/tokens"} />
            </>
          }
          endContent={
            <Button
              label={mode === "dark" ? "Light" : "Dark"}
              variant="ghost"
              onClick={() => setMode(mode === "dark" ? "light" : "dark")}
            />
          }
        />
      }
      sideNav={
        <ClientOnly>
          <SideNav
            header={<SideNavHeading heading="OpenSeat" headingHref="/" />}
            topContent={
              <TextInput
                label="Search"
                isLabelHidden
                placeholder="Search"
                startIcon={<Icon icon="search" />}
                value={query}
                onChange={(value) => setQuery(value)}
                hasClear
              />
            }
          >
            <SideNavItem
              label="Overview"
              href="/"
              isSelected={path === "/"}
              icon={<Icon icon="viewColumns" />}
            />
            {groups.map((group) => (
              <SideNavItem
                key={group.category}
                label={group.category}
                icon={<Icon icon={group.icon} />}
                collapsible
              >
                {group.items.map((item) => {
                  const href = itemHref(item.slug);
                  return (
                    <SideNavItem
                      key={item.slug}
                      label={item.title}
                      href={href}
                      isSelected={path === href}
                    />
                  );
                })}
              </SideNavItem>
            ))}
          </SideNav>
        </ClientOnly>
      }
    >
      {children}
    </AppShell>
  );
}
