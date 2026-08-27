"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Locale } from "@/lib/locale";

import { setLocale } from "../../locale-actions";

type NavigationItem = Readonly<{
  href: string;
  index: string;
  label: string;
}>;

export function AppNavigation({
  alternateLanguage,
  items,
  languageLabel,
  locale,
  mode,
  navigationLabel,
}: Readonly<{
  alternateLanguage: string;
  items: readonly NavigationItem[];
  languageLabel: string;
  locale: Locale;
  mode: "desktop" | "language" | "mobile";
  navigationLabel: string;
}>) {
  const pathname = usePathname();

  if (mode === "language") {
    return (
      <form action={setLocale}>
        <input
          name="locale"
          type="hidden"
          value={locale === "th" ? "en" : "th"}
        />
        <input name="returnTo" type="hidden" value={pathname} />
        <button
          className="rounded-full border border-border px-3 py-2 text-xs font-bold tracking-[0.16em] text-foreground/70 transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          title={languageLabel}
          type="submit"
        >
          {alternateLanguage}
        </button>
      </form>
    );
  }

  if (mode === "mobile") {
    return (
      <nav
        aria-label={navigationLabel}
        className="mx-auto grid max-w-lg grid-cols-5 px-2 py-2"
      >
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`group flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "bg-foreground/[0.06] text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              href={item.href}
              key={item.href}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full transition ${
                  active
                    ? "bg-primary shadow-[0_0_10px_var(--primary)]"
                    : "bg-foreground/25 group-hover:bg-foreground/60"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label={navigationLabel} className="space-y-2">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl px-4 py-3.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active
                ? "bg-foreground/[0.07] text-foreground"
                : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
            }`}
            href={item.href}
            key={item.href}
          >
            <span
              className={`font-mono text-[10px] ${active ? "text-primary" : "text-foreground/25"}`}
            >
              {item.index}
            </span>
            <span className="text-sm font-semibold">{item.label}</span>
            {active ? (
              <span
                aria-hidden="true"
                className="absolute inset-y-3 right-0 w-0.5 rounded-full bg-primary shadow-[0_0_14px_var(--primary)]"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/profile") {
    return (
      pathname === "/profile" ||
      pathname.startsWith("/profile/") ||
      pathname === "/account" ||
      pathname.startsWith("/users/")
    );
  }

  return pathname === href;
}
