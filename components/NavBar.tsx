"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingCount } from "@/hooks/useContributions";
import { useOfflineSync } from "@/hooks/useOfflineSync";

export function NavBar() {
  const { appUser, signOut, hasRole } = useAuth();
  const pathname = usePathname();
  const { count: pendingCount } = usePendingCount();
  const { isOnline, pendingCount: offlineCount } = useOfflineSync();

  const isChronicler = hasRole("chronicler");
  const isAdmin = hasRole("admin");
  const isChroniclerMode = isChronicler && pathname.startsWith("/chronicler");

  const links = [
    { href: "/dashboard", label: "Príspevky", show: true },
    { href: "/events", label: "Udalosti", show: true },
    {
      href: "/chronicler",
      label: "Kronikár",
      show: isChronicler,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    { href: "/admin", label: "Správa", show: isAdmin || isChronicler },
  ];

  return (
    <nav className={`sticky top-0 z-40 border-b bg-canvas/95 backdrop-blur-sm ${
      isChroniclerMode
        ? "border-b-violet-300 border-t-2 border-t-violet-500"
        : "border-rim"
    }`}>
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none">
          {links
            .filter((l) => l.show)
            .map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname.startsWith(l.href)
                    ? "bg-gold-dim text-gold"
                    : "text-ink-dim hover:bg-surface hover:text-ink"
                }`}
              >
                {l.label}
                {l.badge !== undefined && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-ink">
                    {l.badge > 99 ? "99+" : l.badge}
                  </span>
                )}
              </Link>
            ))}
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-2">
          {/* Offline / pending upload indicator */}
          {!isOnline && (
            <span
              title="Offline – príspevky sa uložia lokálne"
              className="flex items-center gap-1 text-xs text-ink-subtle"
            >
              <CloudOffIcon />
            </span>
          )}
          {isOnline && offlineCount > 0 && (
            <span
              title={`${offlineCount} príspevok čaká na odoslanie`}
              className="flex items-center gap-1 text-xs text-gold"
            >
              <CloudUpIcon />
              <span className="text-[10px] font-bold">{offlineCount}</span>
            </span>
          )}

          {isChroniclerMode && (
            <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200">
              <PenIcon />
              Kronikár
            </span>
          )}
          {appUser?.photoURL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={appUser.photoURL}
              alt={appUser.displayName}
              className={`h-7 w-7 rounded-full ${isChroniclerMode ? "ring-2 ring-violet-400" : "ring-1 ring-rim"}`}
            />
          )}
          <button
            onClick={signOut}
            className="rounded-lg px-2.5 py-1.5 text-xs text-ink-subtle hover:bg-surface hover:text-ink-dim"
          >
            Odhlásiť
          </button>
        </div>
      </div>
    </nav>
  );
}

function CloudOffIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 0 1 0 9Z" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function CloudUpIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 0 1 0 9Z" />
      <polyline points="12 12 12 8 10 10" />
      <line x1="12" y1="8" x2="14" y2="10" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
