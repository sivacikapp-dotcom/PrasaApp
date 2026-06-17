import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/pending"];

function buildCsp(nonce: string): string {
  const storageSrc = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    ? `https://${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}`
    : "";

  return [
    "default-src 'self'",
    // 'strict-dynamic' trusts scripts loaded by nonce-bearing scripts; host allowlists
    // are kept as CSP2 fallback for browsers that don't support strict-dynamic.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://*.googleapis.com https://*.gstatic.com https://apis.google.com https://www.gstatic.com https://accounts.google.com`,
    // unsafe-inline required for JSX style={{ }} attributes which can't carry nonces.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    [
      "img-src 'self' blob: data:",
      "https://*.googleapis.com",
      "https://*.gstatic.com",
      "https://*.googleusercontent.com",
      "https://firebasestorage.googleapis.com",
      storageSrc,
      "https://*.mapbox.com",
    ].filter(Boolean).join(" "),
    [
      "connect-src 'self'",
      "wss://*.firebaseio.com",
      "https://*.googleapis.com",
      "https://*.firebase.com",
      "https://*.firebaseio.com",
      "https://firebasestorage.googleapis.com",
      storageSrc,
      "https://accounts.google.com",
      "https://*.mapbox.com",
      "https://events.mapbox.com",
      "https://nominatim.openstreetmap.org",
    ].filter(Boolean).join(" "),
    "frame-src https://accounts.google.com https://*.firebaseapp.com",
    "worker-src 'self' blob:",
    [
      "media-src 'self' blob:",
      "https://firebasestorage.googleapis.com",
      storageSrc,
    ].filter(Boolean).join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes verify Firebase tokens independently; CSP not relevant for JSON responses.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Pass nonce to Next.js so it stamps it on all generated <script> tags.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!isPublic) {
    const session = request.cookies.get("session")?.value;
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.png$|.*\\.json$|.*\\.ico$|.*\\.svg$|.*\\.webp$).*)",
  ],
};
