"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// 1. Pôvodnú logiku iba premenujeme na pod-komponentu
function LoginFormContent() {
  const { firebaseUser, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    if (loading || !firebaseUser) return;
    const from = params.get("from") ?? "/dashboard";
    router.replace(from);
  }, [firebaseUser, loading, router, params]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 bg-canvas">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gold">Kronika</h1>
        <p className="mt-2 text-ink-dim">Systém na zaznamenávanie udalostí</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-rim bg-surface p-8 shadow-xl">
        <h2 className="mb-6 text-center text-base font-semibold text-ink">Prihlásenie</h2>
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-rim bg-surface-high px-4 py-3 text-sm font-medium"
        >
          <GoogleIcon />
          Prihlásiť cez Google
        </button>
      </div>
    </main>
  );
}

// 2. Hlavný export stránky, ktorý Next.js očakáva, obalíme do Suspense
export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-canvas text-ink-dim">
        Načítava sa...
      </main>
    }>
      <LoginFormContent />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22-.19-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
    </svg>
  );
}