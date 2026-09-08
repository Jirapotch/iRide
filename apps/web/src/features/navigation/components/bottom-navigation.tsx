"use client";

import { usePathname } from "next/navigation";

import type { Locale } from "@/lib/locale";

import { NavigationLinks } from "./navigation-links";

export function BottomNavigation({
  locale,
  username,
}: {
  readonly locale: Locale;
  readonly username: string | null;
}) {
  const pathname = usePathname();
  return (
    <nav
      className="bottom-nav"
      aria-label={locale === "th" ? "เมนูหลัก" : "Primary navigation"}
    >
      <NavigationLinks
        locale={locale}
        pathname={pathname}
        username={username}
      />
    </nav>
  );
}
