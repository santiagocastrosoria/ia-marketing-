import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isDemoUserEnabled, isSupabaseConfigured } from "@/lib/utils/config";

const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/brand-knowledge",
  "/objectives",
  "/strategy",
  "/campaign-generator",
  "/campaigns",
  "/approvals",
  "/metrics",
  "/settings",
];

const PUBLIC_API_PREFIXES = ["/api/auth/"];

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isProtectedApi(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  return !PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isPublicAuthPage(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/auth/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured()) {
    const allowDemo = isDemoUserEnabled();

    if (isProtectedPage(pathname) && !allowDemo) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (isProtectedApi(pathname) && !allowDemo) {
      return NextResponse.json(
        {
          error: true,
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para acceder a este recurso.",
        },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  const { supabaseResponse, user } = await updateSession(request);
  const hasSession = !!user;
  const allowDemo = isDemoUserEnabled() && !hasSession;

  if (isPublicAuthPage(pathname)) {
    if (hasSession) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      dashboardUrl.search = "";
      return NextResponse.redirect(dashboardUrl);
    }
    return supabaseResponse;
  }

  if (isProtectedPage(pathname) && !hasSession && !allowDemo) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtectedApi(pathname) && !hasSession && !allowDemo) {
    return NextResponse.json(
      {
        error: true,
        code: "UNAUTHORIZED",
        message: "Debes iniciar sesión para acceder a este recurso.",
      },
      { status: 401 }
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
