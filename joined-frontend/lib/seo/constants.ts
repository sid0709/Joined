/** Matches backend-core/jobs maxSearchCatalog on GET /v1/search/jobs with no criteria. */
export const SITEMAP_JOB_LIMIT = 2000;

export const SITEMAP_HOME_PRIORITY = 1;
export const SITEMAP_JOB_PRIORITY = 0.8;
export const SITEMAP_HOME_CHANGE = "daily" as const;
export const SITEMAP_JOB_CHANGE = "weekly" as const;

export const MS_PER_HOUR = 60 * 60 * 1000;

export const SCHEMA_CONTEXT = "https://schema.org";
export const JOB_POSTING_TYPE = "JobPosting";
export const ORGANIZATION_TYPE = "Organization";
export const PLACE_TYPE = "Place";
export const POSTAL_ADDRESS_TYPE = "PostalAddress";
export const MONETARY_AMOUNT_TYPE = "MonetaryAmount";
export const QUANTITATIVE_VALUE_TYPE = "QuantitativeValue";
export const PROPERTY_VALUE_TYPE = "PropertyValue";
export const TELECOMMUTE_LOCATION = "TELECOMMUTE";
export const JSON_LD_SCRIPT_TYPE = "application/ld+json";

export const FALLBACK_JOB_TITLE = "Job";

export const ROBOTS_USER_AGENT = "*";
export const SITEMAP_PATH = "/sitemap.xml";

/** Exact `/company` without also matching public `/companies`. Google supports `$`. */
export const COMPANY_DASHBOARD_EXACT = "/company$";
export const COMPANY_DASHBOARD_PREFIX = "/company/";
export const API_PATH_PREFIX = "/api/";
export const OFFER_PATH_PREFIX = "/offer/";
export const SCHEDULE_PATH_PREFIX = "/schedule/";
export const JOBS_PATH_PREFIX = "/jobs/";
export const COMPANIES_PATH_PREFIX = "/companies/";
