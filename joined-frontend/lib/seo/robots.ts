import { AUTH_PAGE_PATHS, ROUTES } from "@/lib/routes";

import {
  API_PATH_PREFIX,
  COMPANY_DASHBOARD_EXACT,
  COMPANY_DASHBOARD_PREFIX,
  COMPANIES_PATH_PREFIX,
  JOBS_PATH_PREFIX,
  OFFER_PATH_PREFIX,
  ROBOTS_USER_AGENT,
  SCHEDULE_PATH_PREFIX,
  SITEMAP_PATH,
} from "./constants";

export const ROBOTS_ALLOW = [
  ROUTES.search,
  JOBS_PATH_PREFIX,
  COMPANIES_PATH_PREFIX,
  ROUTES.pricing,
];

export const ROBOTS_DISALLOW = [
  ...AUTH_PAGE_PATHS,
  ROUTES.applications,
  ROUTES.interviews,
  ROUTES.messages,
  ROUTES.resumes,
  ROUTES.profile,
  ROUTES.settings,
  COMPANY_DASHBOARD_EXACT,
  COMPANY_DASHBOARD_PREFIX,
  API_PATH_PREFIX,
  OFFER_PATH_PREFIX,
  SCHEDULE_PATH_PREFIX,
];

export type RobotsConfig = {
  rules: {
    userAgent: string;
    allow: string[];
    disallow: string[];
  };
  sitemap?: string;
};

export function publicRobots(origin: string): RobotsConfig {
  return {
    rules: {
      userAgent: ROBOTS_USER_AGENT,
      allow: [...ROBOTS_ALLOW],
      disallow: [...ROBOTS_DISALLOW],
    },
    sitemap: origin ? `${origin}${SITEMAP_PATH}` : undefined,
  };
}
