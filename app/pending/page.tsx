"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";

export default function PendingPage() {
  const { appUser, signOut } = useAuth();
  const { t } = useI18n();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 bg-canvas">
      <div className="w-full max-w-sm rounded-2xl border border-rim bg-surface p-8 shadow-xl text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning-dim">
          <ClockIcon />
        </div>
        <h1 className="text-lg font-semibold text-ink">{t.pending.title}</h1>
        <p className="text-sm text-ink-dim">
          {t.pending.description(appUser?.email ?? "")}
        </p>
        <p className="text-sm text-ink-dim">{t.pending.afterApproval}</p>
        <button
          onClick={signOut}
          className="mt-2 text-sm text-gold hover:underline"
        >
          {t.pending.signOut}
        </button>
      </div>
    </main>
  );
}

function ClockIcon() {
  return (
    <svg className="h-7 w-7 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
