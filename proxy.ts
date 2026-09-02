import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/src/lib/auth";

const AUTH_ROUTES = ["/login", "/register"];
const PROTECTED_PREFIXES = [
  "/inbox",
  "/sent",
  "/drafts",
  "/starred",
  "/trash",
  "/archive",
  "/labels",
  "/contacts",
  "/automation",
  "/settings",
  "/profile",
  "/help",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const isAuthenticated = Boolean(session);

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  const isProtectedRoute =
    pathname === "/" ||
    PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  // If authenticated user visits login or register, redirect to inbox
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/inbox", request.url));
  }

  // If unauthenticated user visits protected pages, redirect to login
  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
  
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
