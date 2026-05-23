"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function PendingPage() {
  const { appUser, signOut } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 bg-canvas">
      <div className="w-full max-w-sm rounded-2xl border border-rim bg-surface p-8 shadow-xl text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning-dim">
          <ClockIcon />
        </div>
        <h1 className="text-lg font-semibold text-ink">Čakáte na schválenie</h1>
        <p className="text-sm text-ink-dim">
          Váš účet <strong className="text-ink">{appUser?.email}</strong> bol zaregistrovaný
          a čaká na aktiváciu správcom aplikácie.
        </p>
        <p className="text-sm text-ink-dim">Po schválení sa môžete prihlásiť znova.</p>
        <button
          onClick={signOut}
          className="mt-2 text-sm text-gold hover:underline"
        >
          Odhlásiť sa
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
