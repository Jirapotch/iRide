"use client";
import { App, ConfigProvider, theme } from "antd";
import thTH from "antd/locale/th_TH";
import enUS from "antd/locale/en_US";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/locale";
export function Providers({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  return (
    <ConfigProvider
      locale={locale === "th" ? thTH : enUS}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#f5b64f",
          colorLink: "#f1efe9",
          colorLinkHover: "#f5b64f",
          colorBgBase: "#121315",
          colorBgContainer: "#1b1c1f",
          colorBorder: "#333438",
          colorText: "#f1efe9",
          colorTextSecondary: "#a2a3a7",
          borderRadius: 12,
          fontFamily: 'Inter, "Noto Sans Thai", system-ui, sans-serif',
          controlHeight: 42,
        },
        components: {
          Button: { primaryColor: "#151413" },
          Table: { headerBg: "#222327" },
          Modal: { contentBg: "#1b1c1f" },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
