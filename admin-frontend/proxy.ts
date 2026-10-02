import { NextResponse, type NextRequest } from "next/server";
import { REQUEST_PATH_HEADER } from "@/lib/staff-session";

/**
 * Hands the requested path to the console layout, so a staff member sent to sign in
 * comes back where they were headed. The layout checks the real session.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const { pathname, search } = request.nextUrl;
  headers.set(REQUEST_PATH_HEADER, `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

// Console pages only: not sign-in, its routes, the API proxy, or static files.
export const config = {
  matcher: ["/((?!api/|auth/|sign-in|_next/|.*\\..*).*)"],
};
