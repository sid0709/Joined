export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  overview: "/overview",
  profile: "/profile",
  resume: "/resume",
  gmail: "/gmail",
} as const;

export const WORKSPACE_TABS = [
  { value: "overview", label: "Statistics", href: ROUTES.overview },
  { value: "profile", label: "Profile", href: ROUTES.profile },
  { value: "resume", label: "Resume", href: ROUTES.resume },
  { value: "gmail", label: "Gmail", href: ROUTES.gmail },
] as const;

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number]["value"];

export function workspaceTab(pathname: string): WorkspaceTab {
  const match = WORKSPACE_TABS.find((tab) => tab.href === pathname);
  return match?.value ?? "overview";
}

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
