"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
} from "react";
import { ConfigProvider } from "antd";

import { themeChanged, type AppTheme } from "@/features/preferences/preferences.slice";
import { resolveTheme } from "@/lib/app-navigation-domain";
import { createThemeConfig } from "@/shared/theme/tokens";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const ThemeContext = createContext<{
  readonly theme: AppTheme;
  readonly setTheme: (theme: AppTheme) => void;
} | null>(null);

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const theme = useAppSelector((state) => state.preferences.theme);
  const dispatch = useAppDispatch();

  function setTheme(value: AppTheme) {
    dispatch(themeChanged(value));
  }

  useEffect(() => {
    dispatch(
      themeChanged(resolveTheme(document.documentElement.dataset.theme, false)),
    );
  }, [dispatch]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <ConfigProvider theme={createThemeConfig(theme)}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
