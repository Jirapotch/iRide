import Link from "next/link";
import type { ReactNode } from "react";

import type { Locale } from "@/lib/locale";
import { BrandMark } from "../../_components/brand-mark";
import { BottomNavigation, HeaderActions } from "./app-navigation";
import { MockAppProvider } from "./mock-app-provider";

export function AppShell({ authenticated, children, locale }: Readonly<{ authenticated: boolean; children: ReactNode; locale: Locale }>) {
  return <MockAppProvider><div className="app-frame" data-theme="iride-premium-blue" data-ui="app-shell">
    <a className="skip-link" href="#main-content">{locale === "th" ? "ข้ามไปยังเนื้อหา" : "Skip to content"}</a>
    <header className="app-header"><div className="header-inner">
      <Link className="brand-link" href="/" aria-label="iRide home"><BrandMark/></Link>
      <HeaderActions authenticated={authenticated} locale={locale}/>
    </div></header>
    <main className="app-main" id="main-content">{children}</main>
    <div className="mobile-nav-shell"><BottomNavigation locale={locale}/></div>
  </div></MockAppProvider>;
}
