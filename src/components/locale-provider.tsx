"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { defaultLocale, isLocale, localeStorageKey } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const localeChangeEvent = "iride-locale-change";

function getClientLocale(): Locale {
  const documentLocale = document.documentElement.lang;
  if (isLocale(documentLocale)) return documentLocale;
  const storedLocale = localStorage.getItem(localeStorageKey);
  return storedLocale && isLocale(storedLocale) ? storedLocale : defaultLocale;
}

function subscribe(onStoreChange: () => void) {
  const handleChange = () => onStoreChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener(localeChangeEvent, handleChange);
  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(localeChangeEvent, handleChange);
  };
}

export function persistLocale(locale: Locale) {
  localStorage.setItem(localeStorageKey, locale);
  document.cookie = `${localeStorageKey}=${locale};path=/;max-age=31536000;samesite=lax`;
  document.documentElement.lang = locale;
}

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const locale = useSyncExternalStore(subscribe, getClientLocale, () => initialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    persistLocale(nextLocale);
    window.dispatchEvent(new Event(localeChangeEvent));
  }, []);

  useEffect(() => {
    if (getClientLocale() !== locale) return;
    persistLocale(locale);
    if (locale !== initialLocale) router.refresh();
  }, [initialLocale, locale, router]);

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}
