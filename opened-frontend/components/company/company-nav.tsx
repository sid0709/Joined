"use client";

import { useEffect, useState } from "react";
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
import type { AuthCompany } from "@/lib/auth/types";
import { canManageCompany, companyRoleLabel } from "@/lib/company/access";
import { fetchTeam } from "@/lib/company/api";
import { ROLE_META, canPermission, currentMemberRole, type TeamRole } from "@/lib/rbac";
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

type NavLink = PageLink & { icon: GlyphName; count?: number };

function groups(
  openJobs: number,
  newApplicants: number,
  showTeam: boolean,
  showBilling: boolean,
  showSettings: boolean,
): { title: string; links: NavLink[] }[] {
  const company: NavLink[] = [{ ...COMPANY_ABOUT_PAGE, icon: "seat" }];
  if (showTeam) company.push({ ...COMPANY_TEAM_PAGE, icon: "users" });
  if (showBilling) company.push({ ...COMPANY_BILLING_PAGE, icon: "file" });
  if (showSettings) company.push({ ...COMPANY_SETTINGS_PAGE, icon: "settings" });
  return [
    {
      title: "Hiring",
      links: [
        { ...COMPANY_HOME_PAGE, icon: "home" },
        { ...COMPANY_JOBS_PAGE, icon: "folder", count: openJobs || undefined },
        { ...COMPANY_APPLICANTS_PAGE, icon: "users", count: newApplicants || undefined },
        { ...COMPANY_INTERVIEWS_PAGE, icon: "calendar" },
        { ...COMPANY_MESSAGES_PAGE, icon: "mail" },
      ],
    },
    { title: "Company", links: company },
  ];
}

/**
 * The deepest link that contains the path — /company/jobs/new still lights up Jobs.
 * Overview only matches itself, so your own pages (My profile, Account settings)
 * light up nothing instead of pretending to be the company overview.
 */
function activeHref(pathname: string, links: NavLink[]) {
  return links
    .filter(
      (link) =>
        pathname === link.href ||
        (link.href !== ROUTES.company && pathname.startsWith(`${link.href}/`)),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** The company workspace switcher: who you’re hiring for, and where you can go. */
export function CompanyNav({
  company,
  unread = 0,
  openJobs = 0,
  newApplicants = 0,
}: {
  company: AuthCompany;
  unread?: number;
  openJobs?: number;
  newApplicants?: number;
}) {
  const pathname = usePathname();
  const manageCompany = canManageCompany(company);
  const [hiringRole, setHiringRole] = useState<TeamRole | null>(null);

  useEffect(() => {
    let active = true;
    fetchTeam()
      .then((team) => {
        if (active) setHiringRole(currentMemberRole(team.members));
      })
      .catch(() => {
        /* soft — nav still works for creator */
      });
    return () => {
      active = false;
    };
  }, []);

  const showTeam =
    manageCompany ||
    canPermission(hiringRole, "team.invite") ||
    canPermission(hiringRole, "team.manage_roles") ||
    canPermission(hiringRole, "audit.view");
  const showBilling = manageCompany || canPermission(hiringRole, "billing.view");
  const showSettings = manageCompany || canPermission(hiringRole, "team.manage_roles");

  const links = groups(openJobs, newApplicants, showTeam, showBilling, showSettings).flatMap(
    (group) => group.links,
  );
  const active = activeHref(pathname, links);
  const sections = groups(openJobs, newApplicants, showTeam, showBilling, showSettings).map(
    (group) => ({
      ...group,
      links: group.links.map((link) =>
        link.href === ROUTES.companyMessages ? { ...link, count: unread || undefined } : link,
      ),
    }),
  );

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
                    {hiringRole ? ROLE_META[hiringRole].label : companyRoleLabel(company)}
                  </Text>
                </Stack>
              </HStack>
            }
          >
            {sections.map((group) => (
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
          {links.map((link) => (
            <Tab key={link.href} value={link.href} label={link.label} href={link.href} />
          ))}
        </TabList>
      </Hide>
    </>
  );
}
