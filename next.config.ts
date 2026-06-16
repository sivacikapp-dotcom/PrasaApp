import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-map-gl", "@vis.gl/react-mapbox"],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "prasaapp-b5944.web.app",
        "prasaapp-b5944.firebaseapp.com",
      ],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "prasaapp-b5944.firebasestorage.app" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/firebase-messaging-sw.js",
        destination: "/api/firebase-messaging-sw",
      },
    ];
  },
  async headers() {
    const firebaseStorageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";
    const storageSrc = firebaseStorageBucket ? `https://${firebaseStorageBucket}` : "";

    const csp = [
      "default-src 'self'",
      // Next.js inline scripts + Firebase SDK + Google APIs
      "script-src 'self' 'unsafe-inline' https://*.googleapis.com https://*.gstatic.com https://apis.google.com https://www.gstatic.com",
      // Tailwind inline styles are required; Google Fonts optional
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      // Images: Firebase Storage, Google user avatars, Mapbox tiles, blob previews
      [
        "img-src 'self' blob: data:",
        "https://*.googleapis.com",
        "https://*.gstatic.com",
        "https://*.googleusercontent.com",
        "https://firebasestorage.googleapis.com",
        storageSrc,
        "https://*.mapbox.com",
      ].filter(Boolean).join(" "),
      // XHR/fetch: Firebase, Mapbox, Nominatim geocoding
      [
        "connect-src 'self'",
        "wss://*.firebaseio.com",
        "https://*.googleapis.com",
        "https://*.firebase.com",
        "https://*.firebaseio.com",
        "https://firebasestorage.googleapis.com",
        storageSrc,
        "https://*.mapbox.com",
        "https://events.mapbox.com",
        "https://nominatim.openstreetmap.org",
      ].filter(Boolean).join(" "),
      // Google OAuth popup
      `frame-src https://accounts.google.com https://*.firebaseapp.com`,
      // Service worker + Mapbox WebGL worker
      "worker-src 'self' blob:",
      // Audio/video from Firebase Storage
      [
        "media-src 'self' blob:",
        "https://firebasestorage.googleapis.com",
        storageSrc,
      ].filter(Boolean).join(" "),
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(self), notifications=(self)",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
