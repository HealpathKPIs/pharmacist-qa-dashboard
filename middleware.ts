import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  canAccessPath,
  getProfileHomePath,
  isAppRole,
  parseAccessibleModules,
} from "@/lib/rbac";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = new Set(["/login"]);

function applyCookies(
  response: NextResponse,
  cookiesToSet: Array<{
    name: string;
    options: Parameters<NextResponse["cookies"]["set"]>[2];
    value: string;
  }>,
) {
  cookiesToSet.forEach(({ name, options, value }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}

function accessDenied(request: NextRequest) {
  const url = request.nextUrl.clone();

  url.pathname = "/access-denied";
  url.search = "";

  return NextResponse.rewrite(url, { status: 403 });
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cookiesToSet: Array<{
    name: string;
    options: Parameters<NextResponse["cookies"]["set"]>[2];
    value: string;
  }> = [];

  if (!supabaseUrl || !supabaseAnonKey) {
    return accessDenied(request);
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (updatedCookies) => {
        cookiesToSet.push(...updatedCookies);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isPublicPath = PUBLIC_PATHS.has(request.nextUrl.pathname);

  if (!user) {
    if (isPublicPath) {
      return applyCookies(NextResponse.next(), cookiesToSet);
    }

    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/login";
    loginUrl.search = "";

    return applyCookies(NextResponse.redirect(loginUrl), cookiesToSet);
  }

  if (request.nextUrl.pathname === "/access-denied") {
    return applyCookies(NextResponse.next(), cookiesToSet);
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("accessible_modules, active, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profileRow || !isAppRole(profileRow.role) || !profileRow.active) {
    return applyCookies(accessDenied(request), cookiesToSet);
  }

  const profile = {
    accessibleModules: parseAccessibleModules(profileRow.accessible_modules),
    role: profileRow.role,
  };

  if (isPublicPath) {
    const homeUrl = request.nextUrl.clone();

    homeUrl.pathname = getProfileHomePath(profile);
    homeUrl.search = "";

    return applyCookies(NextResponse.redirect(homeUrl), cookiesToSet);
  }

  if (!canAccessPath(profile, request.nextUrl.pathname)) {
    return applyCookies(accessDenied(request), cookiesToSet);
  }

  return applyCookies(NextResponse.next(), cookiesToSet);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
