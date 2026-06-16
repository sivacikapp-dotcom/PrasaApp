import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/pending"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes si overujú Firebase tokeny samostatne
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  if (isPublic) return NextResponse.next();

  const session = request.cookies.get("session")?.value;
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.png$|.*\\.json$|.*\\.ico$|.*\\.svg$|.*\\.webp$).*)",
  ],
};
