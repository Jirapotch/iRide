import Image from "next/image";
import type { ReactNode } from "react";

import type { Locale } from "@/lib/locale";
import { BrandMark } from "./brand-mark";

export function StandaloneShell({ children, headerAction, locale, wide = false }: Readonly<{ children: ReactNode; headerAction?: ReactNode; locale: Locale; wide?: boolean }>) {
  return <div className="min-h-screen bg-background text-foreground" data-theme="iride-premium-blue" data-ui="standalone-shell">
    <header className="fixed inset-x-0 top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl"><div className="mx-auto flex h-[var(--header-height)] max-w-6xl items-center justify-between px-5 sm:px-8"><BrandMark />{headerAction}</div></header>
    <main className="grid min-h-screen pt-[var(--header-height)] lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,.95fr)]">
      <section className="relative hidden min-h-[calc(100vh-var(--header-height))] overflow-hidden lg:block"><Image alt="Adventure rider in a mountain valley" className="object-cover" fill priority sizes="55vw" src="/media/hero-road.webp"/><div className="absolute inset-0 bg-black/25"/><div className="absolute inset-x-10 bottom-10 rounded-3xl border border-border bg-background/78 p-7 backdrop-blur-md"><p className="premium-kicker">iRide</p><h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">{locale === "th" ? "ถนนเส้นเดียวกัน เรื่องราวนับไม่ถ้วน" : "One road. Endless stories."}</h2></div></section>
      <section className="grid place-items-center px-5 py-10 sm:px-8"><div className={`w-full ${wide ? "max-w-xl" : "max-w-md"}`}><div className="premium-card p-6 sm:p-9">{children}</div><p className="mt-5 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Ride. Share. Connect.</p></div></section>
    </main>
  </div>;
}
