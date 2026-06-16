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
    const isDev = process.env.NODE_ENV === "development";

    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://*.googleapis.com https://*.gstatic.com https://apis.google.com https://www.gstatic.com https://accounts.google.com`,
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
      `frame-src https://accounts.google.com https://*.firebaseapp.com`,
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

    return [
      {
        source: "/(.*)",
        headers: [
          ...(!isDev ? [{ key: "Content-Security-Policy", value: csp }] : []),
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
        source: "/ffmpeg/ffmpeg-core.wasm",
        headers: [
          { key: "Content-Type", value: "application/wasm" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/ffmpeg/ffmpeg-core.js",
        headers: [
          { key: "Content-Type", value: "text/javascript" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
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
