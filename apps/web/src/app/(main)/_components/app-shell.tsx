import type { ReactNode } from "react";

import type { Locale } from "@/lib/locale";
import { BrandMark } from "../../_components/brand-mark";
import { BottomNavigation, HeaderActions } from "./app-navigation";
import { MockAppProvider } from "./mock-app-provider";
import { PendingLink } from "./pending-link";
import { RouteFocusManager } from "./route-focus-manager";
import { RouteTransition } from "./route-transition";

export function AppShell({
  authenticated,
  canManage = false,
  children,
  locale,
  username = null,
}: Readonly<{
  authenticated: boolean;
  canManage?: boolean;
  children: ReactNode;
  locale: Locale;
  username?: string | null;
}>) {
  return (
    <MockAppProvider>
      <div className="app-frame" data-ui="app-shell">
        <a className="skip-link" href="#main-content">
          {locale === "th" ? "ข้ามไปยังเนื้อหา" : "Skip to content"}
        </a>
        <header className="app-header">
          <div className="header-inner">
            <PendingLink
              className="brand-link"
              href="/"
              aria-label="iRide home"
            >
              <BrandMark />
            </PendingLink>
            <HeaderActions
              authenticated={authenticated}
              canManage={canManage}
              locale={locale}
              username={username}
            />
          </div>
        </header>
        <RouteFocusManager />
        <main className="app-main" id="main-content">
          <RouteTransition>{children}</RouteTransition>
        </main>
        <div className="mobile-nav-shell">
          <BottomNavigation locale={locale} username={username} />
        </div>
      </div>
    </MockAppProvider>
  );
}
