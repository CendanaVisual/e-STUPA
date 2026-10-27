import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";

/**
 * Proxy (pengganti middleware di Next.js 16) — pemeriksaan optimistis:
 * - Belum login → /login
 * - /admin/** hanya SUPERADMIN, /guru/** hanya GURU
 * Otorisasi final tetap dilakukan di server (requireRole / assertPembelajaranAccess).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  const home = session?.role === "SUPERADMIN" ? "/admin" : "/guru";

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? home : "/login", request.url));
  }

  if (pathname === "/login") {
    if (session) return NextResponse.redirect(new URL(home, request.url));
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && session.role !== "SUPERADMIN") {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }
  if (pathname.startsWith("/guru") && session.role !== "GURU") {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/admin",
    "/admin/:path*",
    "/guru",
    "/guru/:path*",
    "/forbidden",
  ],
};
