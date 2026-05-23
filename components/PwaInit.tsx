"use client";

import { useEffect, useState } from "react";
import { IosInstallPrompt } from "./IosInstallPrompt";

// Chrome / Edge / Samsung Browser fires this before showing the mini install bar
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInit() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("SW registration failed:", err));
    }

    // Capture the deferred install prompt (Android / desktop Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstallEvent(null);
    else setInstallDismissed(true);
  }

  const showAndroidBanner =
    installEvent !== null && !installDismissed;

  return (
    <>
      {showAndroidBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <div className="rounded-2xl bg-surface-high border border-rim-strong shadow-2xl p-4 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold text-gold-text">
              <BookIcon />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">Nainštalovať Kroniku</p>
              <p className="text-xs text-ink-dim mt-0.5">Pridajte apku na plochu pre rýchly prístup</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setInstallDismissed(true)}
                className="rounded-lg px-3 py-1.5 text-xs text-ink-subtle hover:text-ink"
              >
                Neskôr
              </button>
              <button
                onClick={handleInstall}
                className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-gold-text"
              >
                Inštalovať
              </button>
            </div>
          </div>
        </div>
      )}
      <IosInstallPrompt />
    </>
  );
}

function BookIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
