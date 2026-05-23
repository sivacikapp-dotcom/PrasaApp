"use client";

import { useEffect, useState } from "react";

export function IosInstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !("MSStream" in window);
    const isStandalone =
      "standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissed = sessionStorage.getItem("ios-prompt-dismissed") === "1";

    if (isIos && !isStandalone && !dismissed) {
      // Small delay so the page paints first
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    sessionStorage.setItem("ios-prompt-dismissed", "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      <div className="rounded-2xl bg-surface-high border border-rim-strong shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold text-gold-text">
            <BookIcon />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">Pridajte Kroniku na plochu</p>
            <p className="mt-1 text-xs text-ink-dim leading-relaxed">
              Klepnite na{" "}
              <span className="inline-flex items-center gap-0.5 align-middle">
                <ShareIcon />
              </span>{" "}
              v Safari a vyberte{" "}
              <strong className="text-ink">"Pridať na plochu"</strong>.
            </p>
            <p className="mt-1 text-xs text-ink-subtle">
              Spustíte apku plnohodnotne bez prehliadača.
            </p>
          </div>

          <button
            onClick={dismiss}
            className="shrink-0 p-1 text-ink-subtle hover:text-ink"
            aria-label="Zatvoriť"
          >
            <XIcon />
          </button>
        </div>

        {/* Step indicators */}
        <div className="mt-3 flex gap-2">
          {[
            { step: "1", label: "Otvorte v Safari" },
            { step: "2", label: "Zdieľať" },
            { step: "3", label: "Pridať na plochu" },
          ].map(({ step, label }) => (
            <div key={step} className="flex flex-1 items-center gap-1.5 rounded-lg bg-surface px-2 py-1.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold text-gold-text text-[10px] font-bold">
                {step}
              </span>
              <span className="text-[10px] text-ink-dim leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
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

function ShareIcon() {
  return (
    <svg className="h-4 w-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
