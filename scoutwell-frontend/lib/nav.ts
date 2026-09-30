import type { PillNavItem } from "@openseat/design-system";
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
export function activeHref(pathname: string): string | undefined {
  return ALL_PAGES.filter(
    (page) => pathname === page.href || pathname.startsWith(`${page.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
