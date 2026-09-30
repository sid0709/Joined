import type { AppRailItem } from "@openseat/design-system";
import {
  ACCOUNT_PAGE,
  DASHBOARD_PAGE,
  DEVELOPERS_PAGE,
  EARNINGS_PAGE,
  LEVEL_PAGE,
  NOTIFICATIONS_PAGE,
  PAYOUTS_PAGE,
  SUBMISSIONS_PAGE,
  SUBMIT_PAGE,
  type PageLink,
} from "./routes";

/** Where the rail, the ⌘K palette and the breadcrumbs all read the app's pages from. */

/** Every page a scout can open, in the order the palette lists them. */
export const ALL_PAGES: PageLink[] = [
  DASHBOARD_PAGE,
  SUBMIT_PAGE,
  SUBMISSIONS_PAGE,
  EARNINGS_PAGE,
  PAYOUTS_PAGE,
  LEVEL_PAGE,
  NOTIFICATIONS_PAGE,
  DEVELOPERS_PAGE,
  ACCOUNT_PAGE,
];

/** The rail keeps the daily places; settings-like pages live in the account menu. */
export function railItems(inReview: number): AppRailItem[] {
  return [
    { ...DASHBOARD_PAGE, icon: "home" },
    { ...SUBMISSIONS_PAGE, icon: "folder", count: inReview },
    {
      ...EARNINGS_PAGE,
      icon: "star",
      children: [
        { href: PAYOUTS_PAGE.href, label: PAYOUTS_PAGE.label },
        { href: LEVEL_PAGE.href, label: LEVEL_PAGE.label },
      ],
    },
  ];
}

/** The deepest page that contains the path: /submissions/abc still lights up Submissions. */
export function activeHref(pathname: string): string | undefined {
  return ALL_PAGES.filter(
    (page) => pathname === page.href || pathname.startsWith(`${page.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export type Crumb = { label: string; href?: string };

/** Pages that belong to another page's area in the rail. */
const PARENT: Record<string, PageLink> = {
  [PAYOUTS_PAGE.href]: EARNINGS_PAGE,
  [LEVEL_PAGE.href]: EARNINGS_PAGE,
};

const DETAIL_LABEL = "Details";

/** The trail shown in the top bar, ending on the current page (which is not a link). */
export function breadcrumbs(pathname: string): Crumb[] {
  const href = activeHref(pathname);
  const page = ALL_PAGES.find((candidate) => candidate.href === href);
  if (!page) return [];

  const trail: Crumb[] = [];
  const parent = PARENT[page.href];
  if (parent) trail.push({ label: parent.label, href: parent.href });

  if (pathname === page.href) return [...trail, { label: page.label }];
  return [...trail, { label: page.label, href: page.href }, { label: DETAIL_LABEL }];
}
