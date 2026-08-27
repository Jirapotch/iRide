import type { ReactNode } from "react";

import type { Locale } from "@/lib/locale";

import { BrandMark } from "../../_components/brand-mark";
import { AppNavigation } from "./app-navigation";

const copy = {
  th: {
    brandLabel: "ชุมชนของคนรักการขับขี่",
    languageLabel: "เปลี่ยนภาษา",
    navigationLabel: "เมนูหลัก",
    alternateLanguage: "English",
    items: [
      { href: "/", index: "01", label: "ฟีด" },
      { href: "/explore", index: "02", label: "สำรวจ" },
      { href: "/create", index: "03", label: "สร้าง" },
      { href: "/garage", index: "04", label: "โรงรถ" },
      { href: "/profile", index: "05", label: "โปรไฟล์" },
    ],
  },
  en: {
    brandLabel: "The community for every drive",
    languageLabel: "Change language",
    navigationLabel: "Primary navigation",
    alternateLanguage: "ภาษาไทย",
    items: [
      { href: "/", index: "01", label: "Feed" },
      { href: "/explore", index: "02", label: "Explore" },
      { href: "/create", index: "03", label: "Create" },
      { href: "/garage", index: "04", label: "Garage" },
      { href: "/profile", index: "05", label: "Profile" },
    ],
  },
} as const;

export function AppShell({
  children,
  locale,
}: Readonly<{ children: ReactNode; locale: Locale }>) {
  const text = copy[locale];

  return (
    <div
      className="iride-shell min-h-screen bg-background text-foreground"
      data-theme="automotive-premium"
      data-ui="app-shell"
    >
      <a
        className="sr-only rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        href="#main-content"
      >
        {locale === "th" ? "ข้ามไปยังเนื้อหา" : "Skip to content"}
      </a>

      <header className="fixed inset-x-0 top-0 z-30 h-20 border-b border-border bg-background/95 backdrop-blur md:left-64">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <BrandMark />
            <span className="text-lg font-black tracking-[-0.04em]">iRide</span>
          </div>
          <p className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground md:block">
            {text.brandLabel}
          </p>
          <AppNavigation
            alternateLanguage={text.alternateLanguage}
            items={text.items}
            languageLabel={text.languageLabel}
            locale={locale}
            mode="language"
            navigationLabel={text.navigationLabel}
          />
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface p-6 md:flex">
        <div className="flex items-center gap-3 px-2 py-2">
          <BrandMark />
          <div>
            <p className="text-xl font-black tracking-[-0.05em]">iRide</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Drive together
            </p>
          </div>
        </div>
        <div className="mt-14 flex-1">
          <AppNavigation
            alternateLanguage={text.alternateLanguage}
            items={text.items}
            languageLabel={text.languageLabel}
            locale={locale}
            mode="desktop"
            navigationLabel={text.navigationLabel}
          />
        </div>
        <div className="rounded-2xl border border-border bg-foreground/[0.03] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {locale === "th" ? "สถานะ" : "Status"}
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-foreground/65">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_14px_var(--primary)]" />
            {locale === "th" ? "พร้อมออกเดินทาง" : "Ready to drive"}
          </div>
        </div>
      </aside>

      <main
        className="min-h-screen px-5 pb-28 pt-28 sm:px-8 md:ml-64 md:pb-12"
        id="main-content"
      >
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <AppNavigation
          alternateLanguage={text.alternateLanguage}
          items={text.items}
          languageLabel={text.languageLabel}
          locale={locale}
          mode="mobile"
          navigationLabel={text.navigationLabel}
        />
      </div>
    </div>
  );
}
