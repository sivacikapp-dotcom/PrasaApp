"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n, type Locale } from "@/contexts/I18nContext";

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: "sk", label: "Slovenčina", flag: "🇸🇰" },
  { code: "cs", label: "Čeština",    flag: "🇨🇿" },
  { code: "pl", label: "Polski",     flag: "🇵🇱" },
  { code: "en", label: "English",    flag: "🇬🇧" },
  { code: "fr", label: "Français",   flag: "🇫🇷" },
  { code: "zh", label: "中文",        flag: "🇨🇳" },
];

interface LanguageSwitcherProps {
  inline?: boolean;
}

export function LanguageSwitcher({ inline = false }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function select(code: Locale) {
    setLocale(code);
    setOpen(false);
  }

  if (inline) {
    return (
      <div className="flex flex-wrap gap-1">
        {LANGUAGES.map(({ code, label, flag }) => (
          <button
            key={code}
            onClick={() => setLocale(code)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              locale === code
                ? "bg-gold-dim text-gold font-medium"
                : "text-ink hover:bg-surface"
            }`}
          >
            <span aria-hidden="true">{flag}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
          open
            ? "bg-gold-dim text-gold"
            : "text-ink-subtle hover:bg-surface hover:text-ink-dim"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span aria-hidden="true">{current.flag}</span>
        <span className="uppercase">{current.code}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-xl border border-rim bg-surface-high shadow-lg py-1 overflow-hidden"
        >
          {LANGUAGES.map(({ code, label, flag }) => (
            <button
              key={code}
              role="option"
              aria-selected={locale === code}
              onClick={() => select(code)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                locale === code
                  ? "bg-gold-dim text-gold font-medium"
                  : "text-ink hover:bg-surface"
              }`}
            >
              <span aria-hidden="true" className="text-base leading-none">{flag}</span>
              <span>{label}</span>
              {locale === code && (
                <svg className="ml-auto h-3.5 w-3.5 text-gold shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M1.5 6l3 3 6-6" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M2 4l4 4 4-4" />
    </svg>
  );
}
