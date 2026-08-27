import type { ReactNode } from "react";

import type { Locale } from "@/lib/locale";

import { BrandMark } from "./brand-mark";

export function StandaloneShell({
  children,
  headerAction,
  locale,
  wide = false,
}: Readonly<{
  children: ReactNode;
  headerAction?: ReactNode;
  locale: Locale;
  wide?: boolean;
}>) {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-background text-foreground"
      data-theme="automotive-premium"
      data-ui="standalone-shell"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-52 -top-52 h-[36rem] w-[36rem] rounded-full border border-primary/15"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-28 h-[25rem] w-[25rem] rounded-full border border-foreground/[0.07]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-56 -left-56 h-[34rem] w-[34rem] rounded-full border border-primary/10"
      />

      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-lg font-black tracking-[-0.05em]">iRide</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">
                Drive together
              </p>
            </div>
          </div>
          {headerAction}
        </div>
      </header>

      <main className="relative z-[1] grid min-h-screen place-items-center px-5 pb-10 pt-28 sm:px-8">
        <div className={`w-full ${wide ? "max-w-xl" : "max-w-lg"}`}>
          <section className="overflow-hidden rounded-[2rem] border border-border bg-surface/95 p-6 shadow-2xl shadow-black/35 backdrop-blur sm:p-9">
            {children}
          </section>
          <p className="mt-5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {locale === "th"
              ? "ถนนเส้นเดียวกัน เรื่องราวนับไม่ถ้วน"
              : "One road. Endless stories."}
          </p>
        </div>
      </main>
    </div>
  );
}
