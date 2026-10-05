import type { PillNavItem } from "@joined/design-system";
import {
  ACCOUNT_PAGE,
  DASHBOARD_PAGE,
  DEVELOPERS_PAGE,
  EARN_PAGE,
  EARNINGS_PAGE,
  FAQ_PAGE,
  HOW_IT_WORKS_PAGE,
  INSTALL_PAGE,
  LEVEL_PAGE,
  NOTIFICATIONS_PAGE,
  PAYOUTS_PAGE,
  SUBMISSIONS_PAGE,
  SUBMIT_PAGE,
  type PageLink,
} from "./routes";

/** Every page a scout can open, used to mark the active pill. */
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

/** Public site pages linked from the signed-out (and marketing) top bar. */
export const MARKETING_PAGES: PageLink[] = [HOW_IT_WORKS_PAGE, EARN_PAGE, INSTALL_PAGE, FAQ_PAGE];

/** The pills in the top bar. API access and Account live in the account menu. */
export function navItems(inReview: number, unread: number): PillNavItem[] {
  return [
    { ...DASHBOARD_PAGE, icon: "home" },
    { ...SUBMISSIONS_PAGE, icon: "folder", count: inReview },
    { ...EARNINGS_PAGE, icon: "star" },
    { ...PAYOUTS_PAGE, icon: "download" },
    { ...LEVEL_PAGE, icon: "sparkle" },
    { ...NOTIFICATIONS_PAGE, icon: "bell", count: unread },
  ];
}

/** The deepest page that contains the path: /submissions/abc still lights up Submissions. */
export function activeHref(
  pathname: string,
  pages: readonly PageLink[] = ALL_PAGES,
): string | undefined {
  return pages
    .filter((page) => pathname === page.href || pathname.startsWith(`${page.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
