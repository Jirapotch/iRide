"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import { resolveTheme, type AppTheme } from "@/lib/app-navigation-domain";

const STORAGE_KEY = "iride-theme";
const ThemeContext = createContext<{
  readonly theme: AppTheme;
  readonly setTheme: (theme: AppTheme) => void;
} | null>(null);

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() =>
    typeof document === "undefined"
      ? "dark"
      : resolveTheme(document.documentElement.dataset.theme, false),
  );

  function setTheme(value: AppTheme) {
    setThemeState(value);
    window.localStorage.setItem(STORAGE_KEY, value);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
