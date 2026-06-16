import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/pending"];

function buildCsp(nonce: string): string {
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";
  const storageSrc = storageBucket ? `https://${storageBucket}` : "";

  return [
    "default-src 'self'",
    // Nonce nahrádza unsafe-inline — Next.js automaticky pridá nonce na svoje hydratačné skripty
    `script-src 'self' 'nonce-${nonce}' https://*.googleapis.com https://*.gstatic.com https://apis.google.com https://www.gstatic.com https://accounts.google.com`,
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
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV === "development";

  // API routes si overujú Firebase tokeny samostatne
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // Presmerovanie neprihlásených na login
  if (!isPublic) {
    const session = request.cookies.get("session")?.value;
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Generujeme nonce pre každú požiadavku — Next.js ho automaticky pridá
  // na svoje inline hydratačné skripty keď je nastavený v x-nonce hlavičke
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!isDev) {
    response.headers.set("Content-Security-Policy", buildCsp(nonce));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.png$|.*\\.json$|.*\\.ico$|.*\\.svg$|.*\\.webp$).*)",
  ],
};
