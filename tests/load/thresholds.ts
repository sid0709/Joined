/** Local load-test limits. CI does not run this harness. */

export const LOAD_VUS = 4;
export const LOAD_DURATION_MS = 2_000;
export const LOAD_P95_MS = 500;
export const LOAD_ERROR_RATE = 0.01;

/** Safety cap so a frozen clock cannot spin. */
export const LOAD_MAX_WAVES = 10_000;

export const SEARCH_PATH = "/v1/search/jobs";
export const JOB_PATH_PREFIX = "/jobs/";

export const DEFAULT_API_ORIGIN = "http://127.0.0.1:8080";
export const DEFAULT_WEB_ORIGIN = "http://localhost:6002";

export const PRODUCTION_HOST = "joinedhq.com";
