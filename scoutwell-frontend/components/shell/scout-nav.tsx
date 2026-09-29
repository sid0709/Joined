"use client";

import { usePathname } from "next/navigation";
import {
  Avatar,
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
  type BadgeVariant,
  type GlyphName,
} from "@openseat/design-system";
import {
  ACCOUNT_PAGE,
  DASHBOARD_PAGE,
  DEVELOPERS_PAGE,
  EARNINGS_PAGE,
  LEVEL_PAGE,
  NOTIFICATIONS_PAGE,
  PAYOUTS_PAGE,
  ROUTES,
  SUBMISSIONS_PAGE,
  SUBMIT_PAGE,
  type PageLink,
} from "@/lib/routes";

const AVATAR_SIZE = 36;

type NavLink = PageLink & { icon: GlyphName; count?: number };

const GROUPS: { title: string; links: NavLink[] }[] = [
  {
    title: "Scouting",
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
  {
    title: "Account",
    links: [
      { ...NOTIFICATIONS_PAGE, icon: "bell" },
      { ...DEVELOPERS_PAGE, icon: "code" },
      { ...ACCOUNT_PAGE, icon: "settings" },
    ],
  },
];

const LINKS = GROUPS.flatMap((group) => group.links);

/** The deepest link that contains the path: /submissions/abc still lights up Submissions. */
function activeHref(pathname: string) {
  return LINKS.filter(
    (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function ScoutNav({
  name,
  levelLabel,
  levelBadge,
  inReview,
  unread,
}: {
  name: string;
  levelLabel: string;
  levelBadge: BadgeVariant;
  inReview: number;
  unread: number;
}) {
  const pathname = usePathname();
  const active = activeHref(pathname) ?? "";
  const counts: Record<string, number> = {
    [ROUTES.submissions]: inReview,
    [ROUTES.notifications]: unread,
  };

  return (
    <>
      <Show from="lg">
        <Sticky offset={4}>
          <SideNav
            header={
              <HStack gap={3} vAlign="center">
                <Avatar name={name} size={AVATAR_SIZE} tooltip={false} />
                <Stack gap={0.5}>
                  <Text weight="semibold">{name}</Text>
                  <HStack gap={1.5} vAlign="center">
                    <Badge label={levelLabel} variant={levelBadge} />
                  </HStack>
                </Stack>
              </HStack>
            }
          >
            {GROUPS.map((group) => (
              <SideNavSection key={group.title} title={group.title}>
                {group.links.map((link) => {
                  const count = counts[link.href] ?? 0;
                  return (
                    <SideNavItem
                      key={link.href}
                      label={link.label}
                      href={link.href}
                      icon={<Icon icon={icons[link.icon]} />}
                      isSelected={link.href === active}
                      endContent={
                        count > 0 ? <Badge label={String(count)} variant="neutral" /> : undefined
                      }
                    />
                  );
                })}
              </SideNavSection>
            ))}
          </SideNav>
        </Sticky>
      </Show>
      <Hide from="lg">
        <TabList value={active} onChange={() => {}} overflow="scroll" hasDivider>
          {LINKS.map((link) => (
            <Tab key={link.href} value={link.href} label={link.label} href={link.href} />
          ))}
        </TabList>
      </Hide>
    </>
  );
}
