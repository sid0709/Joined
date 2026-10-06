import { BRAND_NAME } from "sid-ui/brand-name";

export const BRAND = `${BRAND_NAME} Admin`;

/** Browser calls go through this same-origin proxy, which adds the admin token. */
export const API_PROXY = "/api/admin";

/** How long list searches wait after typing stops. */
export const SEARCH_DEBOUNCE_MS = 300;
