import { NextResponse, type NextRequest } from "next/server";
import { ROUTES, signInHref } from "@/lib/nav";
import { REQUEST_PATH_HEADER, STAFF_SESSION_COOKIE } from "@/lib/staff-session";

/**
 * Every console page needs a signed-in staff member. Without a session cookie, go
 * straight to sign-in and come back after. This is optimistic: the console layout
 * still checks the session with the API, so it hands the layout the requested path
 * for the way back.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const path = `${pathname}${search}`;
  if (!request.cookies.has(STAFF_SESSION_COOKIE)) {
    const back = pathname === "/" ? ROUTES.scouting : path;
    return NextResponse.redirect(new URL(signInHref(back), request.url));
  }
  const headers = new Headers(request.headers);
  headers.set(REQUEST_PATH_HEADER, path);
  return NextResponse.next({ request: { headers } });
}

// Console pages only: not sign-in, its routes, the API proxy, or static files.
export const config = {
  matcher: ["/((?!api/|auth/|sign-in|_next/|.*\\..*).*)"],
};
