import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isCompanyModeEnabled } from "@/lib/config";
import { ROUTES, signInHref } from "@/lib/routes";
import { MODE_COOKIE, MODE_HOME, parseWorkspaceMode } from "@/lib/workspace-preference";

/**
 * Three jobs, all cheap cookie reads:
 * - Company mode guard: when disabled, redirect /company/** and /hiring/setup to /.
 * - Mode decides where "/" lands: an employer goes straight to their hiring workspace.
 *   Visitors with no cookie (first visit, search crawlers) always get the public job search.
 * - A candidate's own pages need an account. With no session cookie, send the visitor to
 *   sign in and bring them back. This is optimistic; pages still load the real session.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const companyModeEnabled = isCompanyModeEnabled();

  if (!companyModeEnabled && (pathname.startsWith("/company") || pathname === "/hiring/setup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === ROUTES.search) {
    const mode = parseWorkspaceMode(request.cookies.get(MODE_COOKIE)?.value);
    if (mode === "company" && companyModeEnabled)
      return NextResponse.redirect(new URL(MODE_HOME.company, request.url));
    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL(signInHref(`${pathname}${search}`), request.url));
  }
  return NextResponse.next();
}

// Literal paths: Next reads the matcher at build time. Keep in sync with the
// signed-in candidate routes in lib/routes.ts.
export const config = {
  matcher: [
    "/",
    "/applications/:path*",
    "/interviews/:path*",
    "/messages/:path*",
    "/resumes/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/company/:path*",
    "/hiring/setup",
  ],
};
