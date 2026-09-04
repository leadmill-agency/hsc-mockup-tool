// Staff passcode gate. Everything is staff-only except: the login flow,
// customer proposal pages (/p/<unguessable-token>) and the images those
// pages embed, and static files. If STAFF_PASSCODE is not configured the
// gate is open (fresh clones / local hacking).
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, sha256Hex } from "@/lib/auth";

function isPublic(pathname: string): boolean {
  if (pathname.startsWith("/api/")) {
    // API routes are staff-only except login and proposal-page images —
    // note the dot heuristic below must NOT apply here, or /api/assets/*.png
    // would bypass the gate
    return (
      pathname.startsWith("/api/login") ||
      pathname.startsWith("/api/assets/proposals/")
    );
  }
  return (
    pathname === "/login" ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/c/") || // customer links (unguessable project ids)

    pathname.includes(".") // static assets (/_next/*.js, /favicon.ico, …)
  );
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const passcode = process.env.STAFF_PASSCODE;
  if (!passcode) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await sha256Hex(passcode))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: "/((?!_next/static|_next/image).*)",
};
