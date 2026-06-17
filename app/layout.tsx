import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { PwaInit } from "@/components/PwaInit";

// Force SSR on every request so middleware-generated nonces are applied to all
// Next.js inline scripts. Without this, Vercel's ISR cache would serve stale
// HTML without nonce attributes, causing CSP violations and a broken app.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kronika",
  description: "Systém na zaznamenávanie udalostí pre kroniku spolku",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kronika",
  },
  formatDetection: { telephone: false },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#D4A843",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sk">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
      </head>
      <body className="antialiased">
        <I18nProvider>
          <AuthProvider>
            {children}
            <PwaInit />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
