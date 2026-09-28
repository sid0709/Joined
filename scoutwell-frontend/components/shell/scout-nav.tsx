"use client";

import { usePathname } from "next/navigation";
import {
  Badge,
  Hide,
  HStack,
  Icon,
  Show,
  SideNav,
  SideNavItem,
  SideNavSection,
  Stack,
  Sticky,
  Tab,
  TabList,
  Text,
  icons,
  type GlyphName,
} from "@openseat/design-system";
import { LEVELS } from "@/lib/config";
import {
  DASHBOARD_PAGE,
  EARNINGS_PAGE,
  LEVEL_PAGE,
  PAYOUTS_PAGE,
  ROUTES,
  SUBMIT_PAGE,
  SUBMISSIONS_PAGE,
  type PageLink,
} from "@/lib/routes";
import { useScout } from "@/lib/scout-store";
import { ownedBy } from "@/lib/stats";

type NavLink = PageLink & { icon: GlyphName; count?: number };

const GROUPS: { title: string; links: NavLink[] }[] = [
  {
    title: "Work",
    links: [
      { ...DASHBOARD_PAGE, icon: "home" },
      { ...SUBMIT_PAGE, icon: "plus" },
      { ...SUBMISSIONS_PAGE, icon: "folder" },
    ],
  },
  {
    title: "Rewards",
    links: [
      { ...EARNINGS_PAGE, icon: "star" },
      { ...LEVEL_PAGE, icon: "sparkle" },
      { ...PAYOUTS_PAGE, icon: "file" },
    ],
  },
];

const LINKS = GROUPS.flatMap((group) => group.links);

function activeHref(pathname: string) {
  return LINKS.filter(
    (link) =>
      pathname === link.href ||
      (link.href !== ROUTES.dashboard && pathname.startsWith(`${link.href}/`)),
  ).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function ScoutNav() {
  const pathname = usePathname();
  const { user, state } = useScout();
  const active = activeHref(pathname) ?? (pathname === ROUTES.dashboard ? ROUTES.dashboard : "");
  const reviewCount = user
    ? ownedBy(state.submissions, user.id).filter((item) => item.status === "needs_review").length
    : 0;
  const groups = GROUPS.map((group) => ({
    ...group,
    links: group.links.map((link) =>
      link.href === ROUTES.submissions ? { ...link, count: reviewCount || undefined } : link,
    ),
  }));

  return (
    <>
      <Show from="lg">
        <Sticky offset={4}>
          <SideNav
            header={
              user ? (
                <Stack gap={0.5}>
                  <Text weight="semibold">{user.name}</Text>
                  <HStack gap={2} vAlign="center">
                    <Text type="supporting" color="secondary">
                      {LEVELS[user.level].label}
                    </Text>
                  </HStack>
                </Stack>
              ) : undefined
            }
          >
            {groups.map((group) => (
              <SideNavSection key={group.title} title={group.title}>
                {group.links.map((link) => (
                  <SideNavItem
                    key={link.href}
                    label={link.label}
                    href={link.href}
                    icon={<Icon icon={icons[link.icon]} />}
                    isSelected={link.href === active}
                    endContent={
                      link.count ? (
                        <Badge label={String(link.count)} variant="neutral" />
                      ) : undefined
                    }
                  />
                ))}
              </SideNavSection>
            ))}
          </SideNav>
        </Sticky>
      </Show>
      <Hide from="lg">
        <TabList value={active || pathname} onChange={() => {}} overflow="scroll" hasDivider>
          {LINKS.map((link) => (
            <Tab key={link.href} value={link.href} label={link.label} href={link.href} />
          ))}
        </TabList>
      </Hide>
    </>
  );
}
