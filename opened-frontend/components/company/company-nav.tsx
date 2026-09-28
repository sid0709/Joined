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
import { CompanyLogo } from "@/components/jobs/company-logo";
import { APPLICANTS, COMPANY_JOBS, COMPANY_UNREAD_MESSAGES } from "@/lib/company";
import type { AuthCompany } from "@/lib/auth/types";
import {
  COMPANY_ABOUT_PAGE,
  COMPANY_APPLICANTS_PAGE,
  COMPANY_BILLING_PAGE,
  COMPANY_HOME_PAGE,
  COMPANY_INTERVIEWS_PAGE,
  COMPANY_JOBS_PAGE,
  COMPANY_MESSAGES_PAGE,
  COMPANY_SETTINGS_PAGE,
  COMPANY_TEAM_PAGE,
  ROUTES,
  type PageLink,
} from "@/lib/routes";

const LOGO_SIZE = 40;
const OPEN_JOBS = COMPANY_JOBS.filter((job) => job.status === "open").length;
const NEW_APPLICANTS = APPLICANTS.filter((person) => person.columnId === "new").length;

type NavLink = PageLink & { icon: GlyphName; count?: number };

const GROUPS: { title: string; links: NavLink[] }[] = [
  {
    title: "Hiring",
    links: [
      { ...COMPANY_HOME_PAGE, icon: "home" },
      { ...COMPANY_JOBS_PAGE, icon: "folder", count: OPEN_JOBS },
      { ...COMPANY_APPLICANTS_PAGE, icon: "users", count: NEW_APPLICANTS },
      { ...COMPANY_INTERVIEWS_PAGE, icon: "calendar" },
      { ...COMPANY_MESSAGES_PAGE, icon: "mail", count: COMPANY_UNREAD_MESSAGES },
    ],
  },
  {
    title: "Company",
    links: [
      { ...COMPANY_ABOUT_PAGE, icon: "seat" },
      { ...COMPANY_TEAM_PAGE, icon: "users" },
      { ...COMPANY_BILLING_PAGE, icon: "file" },
      { ...COMPANY_SETTINGS_PAGE, icon: "settings" },
    ],
  },
];

const LINKS = GROUPS.flatMap((group) => group.links);

/**
 * The deepest link that contains the path — /company/jobs/new still lights up Jobs.
 * Overview only matches itself, so your own pages (My profile, Account settings)
 * light up nothing instead of pretending to be the company overview.
 */
function activeHref(pathname: string) {
  return LINKS.filter(
    (link) =>
      pathname === link.href ||
      (link.href !== ROUTES.company && pathname.startsWith(`${link.href}/`)),
  ).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** The company workspace switcher: who you’re hiring for, and where you can go. */
export function CompanyNav({ company }: { company: AuthCompany }) {
  const pathname = usePathname();
  const active = activeHref(pathname);

  return (
    <>
      <Show from="lg">
        <Sticky offset={4}>
          <SideNav
            header={
              <HStack gap={3} vAlign="center">
                <CompanyLogo
                  name={company.name}
                  src={company.logo}
                  companyId={company.id}
                  size={LOGO_SIZE}
                />
                <Stack gap={0.5}>
                  <Text weight="semibold">{company.name}</Text>
                  <Text type="supporting" color="secondary">
                    Hiring workspace
                  </Text>
                </Stack>
              </HStack>
            }
          >
            {GROUPS.map((group) => (
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
        <TabList value={active ?? ""} onChange={() => {}} overflow="scroll" hasDivider>
          {LINKS.map((link) => (
            <Tab key={link.href} value={link.href} label={link.label} href={link.href} />
          ))}
        </TabList>
      </Hide>
    </>
  );
}
