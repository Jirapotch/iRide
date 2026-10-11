"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Segmented } from "antd";
import { Car, Cube, GameController, ArrowUpRight } from "@phosphor-icons/react";
import type { Locale } from "@/lib/locale";
export function SiteHeader({ locale }: { locale: Locale }) {
  const path = usePathname(),
    router = useRouter();
  function changeLocale(value: string | number) {
    document.cookie =
      "iride-locale=" + value + "; Path=/; Max-Age=31536000; SameSite=Lax";
    router.refresh();
  }
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="iRide home">
        <span className="brand-dot" />i<span>RIDE</span>
        <small>YOUR PERSONAL SPACE</small>
      </Link>
      <nav aria-label={locale === "th" ? "หมวดหลัก" : "Main navigation"}>
        {[
          { href: "/garage", label: "Garage", icon: <Car size={18} /> },
          { href: "/knowledge", label: "Knowledge", icon: <Cube size={18} /> },
          {
            href: "/games",
            label: "Games",
            icon: <GameController size={18} />,
          },
        ].map((item) => (
          <Button
            key={item.href}
            type={path.startsWith(item.href) ? "primary" : "text"}
            href={item.href}
            icon={item.icon}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      <div className="header-tools">
        <Segmented
          size="small"
          aria-label="Language"
          value={locale}
          onChange={changeLocale}
          options={["th", "en"]}
        />
        <Link
          href="/"
          className="home-link"
          aria-label={locale === "th" ? "กลับหน้าหลัก" : "Back home"}
        >
          <ArrowUpRight size={20} />
        </Link>
      </div>
    </header>
  );
}
