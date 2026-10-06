import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MAINTENANCE_PATH = "/service-update";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === MAINTENANCE_PATH || pathname.startsWith(`${MAINTENANCE_PATH}/`)) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = MAINTENANCE_PATH;
  url.search = "";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
