import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME, isPublicPath, verifySessionToken } from "@/lib/auth";
import { DASHBOARD_PATH, LOGIN_PATH } from "@/lib/constants";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = await verifySessionToken(
    request.cookies.get(AUTH_COOKIE_NAME)?.value,
  );

  if (!isAuthenticated && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  if (isAuthenticated && isPublicPath(pathname)) {
    return NextResponse.redirect(new URL(DASHBOARD_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
