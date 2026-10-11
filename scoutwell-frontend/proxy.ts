import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { signInHref } from "@/lib/routes";

/**
 * Scout pages need an account. With no session cookie, send the visitor to sign
 * in and bring them back. This is optimistic; layouts still load the real session.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(signInHref(`${pathname}${search}`), request.url));
}

// Literal paths: Next reads the matcher at build time. Keep in sync with ROUTES.
export const config = {
  matcher: [
    "/onboarding",
    "/dashboard/:path*",
    "/submit/:path*",
    "/submissions/:path*",
    "/earnings/:path*",
    "/level/:path*",
    "/payouts/:path*",
    "/notifications/:path*",
    "/account/:path*",
    "/developers/:path*",
  ],
};
