"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SettingsModal } from "@/components/settings/SettingsModal";
import type { SettingsTab } from "@/components/settings/SettingsModal";
import { usePendingCount } from "@/hooks/useContributions";
import { useOfflineSync } from "@/hooks/useOfflineSync";

export function NavBar() {
  const { appUser, signOut, hasRole } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const { count: pendingCount } = usePendingCount();
  const { isOnline, pendingCount: offlineCount } = useOfflineSync();

  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("contributions");
  const menuRef = useRef<HTMLDivElement>(null);

  function openSettings(tab: SettingsTab = "contributions") {
    setSettingsTab(tab);
    setMenuOpen(false);
    setSettingsOpen(true);
  }

  const isChronicler = hasRole("chronicler");
  const isAdmin = hasRole("admin");
  const isChroniclerMode = isChronicler && pathname.startsWith("/chronicler");

  const links = [
    { href: "/dashboard", label: t.nav.contributions, show: true },
    { href: "/events", label: t.nav.events, show: true },
    {
      href: "/chronicler",
      label: t.nav.chronicler,
      show: isChronicler,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    { href: "/admin", label: t.nav.admin, show: isAdmin },
  ];

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <>
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
              <span className="flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-xs text-ink-subtle" title={t.nav.offlineTitle}>
                <CloudOffIcon />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}
            {isOnline && offlineCount > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-gold-dim px-2 py-0.5 text-xs text-gold" title={t.nav.pendingUpload(offlineCount)}>
                <CloudUpIcon />
                <span className="font-semibold">{offlineCount}</span>
              </span>
            )}

            {isChroniclerMode && (
              <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200">
                <PenIcon />
                {t.nav.chroniclerBadge}
              </span>
            )}

            {/* Notification bell */}
            <NotificationBell onOpenSettings={() => openSettings("notifications")} />

            {/* User avatar dropdown */}
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className={`flex items-center justify-center rounded-full transition-all ${
                  isChroniclerMode
                    ? "ring-2 ring-violet-400"
                    : menuOpen
                    ? "ring-2 ring-gold"
                    : "ring-1 ring-rim hover:ring-2 hover:ring-gold/60"
                }`}
                aria-haspopup="true"
                aria-expanded={menuOpen}
                aria-label="Používateľské menu"
              >
                {appUser?.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={appUser.photoURL}
                    alt={appUser.displayName ?? ""}
                    className="h-7 w-7 rounded-full"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-xs font-semibold text-ink-dim">
                    {appUser?.displayName?.[0]?.toUpperCase() ?? "?"}
                  </span>
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-rim bg-surface-high shadow-lg overflow-hidden">
                  {/* Account info */}
                  <div className="flex items-center gap-3 border-b border-rim px-4 py-3">
                    {appUser?.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={appUser.photoURL}
                        alt={appUser.displayName ?? ""}
                        className="h-9 w-9 shrink-0 rounded-full ring-1 ring-rim"
                      />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-semibold text-ink-dim">
                        {appUser?.displayName?.[0]?.toUpperCase() ?? "?"}
                      </span>
                    )}
                    <div className="min-w-0">
                      {appUser?.displayName && (
                        <p className="truncate text-sm font-medium text-ink">{appUser.displayName}</p>
                      )}
                      {appUser?.email && (
                        <p className="truncate text-xs text-ink-subtle">{appUser.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Language switcher */}
                  <div className="border-b border-rim px-3 py-2">
                    <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                      {t.nav.language}
                    </p>
                    <LanguageSwitcher inline />
                  </div>

                  {/* Settings */}
                  <button
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink transition-colors hover:bg-surface"
                    onClick={() => openSettings("contributions")}
                  >
                    <SettingsIcon />
                    {t.nav.settings}
                  </button>

                  {/* Sign out */}
                  <button
                    onClick={() => { setMenuOpen(false); void signOut(); }}
                    className="flex w-full items-center gap-2.5 border-t border-rim px-4 py-2.5 text-sm text-danger transition-colors hover:bg-surface"
                  >
                    <SignOutIcon />
                    {t.nav.signOut}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {settingsOpen && (
        <SettingsModal
          defaultTab={settingsTab}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
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

function SettingsIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
