"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { sk } from "@/locales/sk";
import { cs } from "@/locales/cs";
import { pl } from "@/locales/pl";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { zh } from "@/locales/zh";
import type { Dictionary } from "@/locales/sk";
import type { Locale as DateFnsLocale } from "date-fns";

export type Locale = "sk" | "cs" | "pl" | "en" | "fr" | "zh";

const dictionaries: Record<Locale, Dictionary> = { sk, cs, pl, en, fr, zh };

const STORAGE_KEY = "app-locale";

interface I18nContextType {
  locale: Locale;
  t: Dictionary;
  dateFnsLocale: DateFnsLocale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType>({
  locale: "sk",
  t: sk,
  dateFnsLocale: sk._meta.dateFnsLocale,
  setLocale: () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("sk");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && stored in dictionaries) {
      setLocaleState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocale(newLocale: Locale) {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  }

  const t = dictionaries[locale];

  return (
    <I18nContext.Provider
      value={{ locale, t, dateFnsLocale: t._meta.dateFnsLocale, setLocale }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
