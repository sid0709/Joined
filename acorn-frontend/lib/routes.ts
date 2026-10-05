export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
} as const;

/** Only same-site paths. Anything else lands on the home page. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return ROUTES.home;
  }
  return value;
}

/** In-page landing target when no store listing URL is configured. */
export const INSTALL_SECTION_ID = "install";
export const INSTALL_HREF = `#${INSTALL_SECTION_ID}`;
