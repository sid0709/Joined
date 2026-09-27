import { NextResponse, type NextRequest } from "next/server";
import { MODE_COOKIE, MODE_HOME, parseWorkspaceMode } from "@/lib/workspace-preference";

/**
 * Mode decides where "/" lands: an employer goes straight to their hiring workspace.
 * Only the bare home page is redirected — every other URL is honored as-is, and visitors
 * with no cookie (first visit, search crawlers) always get the public job search.
 */
export function proxy(request: NextRequest) {
  const mode = parseWorkspaceMode(request.cookies.get(MODE_COOKIE)?.value);
  if (mode === "company") return NextResponse.redirect(new URL(MODE_HOME.company, request.url));
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
