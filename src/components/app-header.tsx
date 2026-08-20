import Link from "next/link";
import { Bell, Plus } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function AppHeader({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href={`/${locale}`} aria-label="iRide home"><BrandMark /></Link>
        <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
          <Link href={`/${locale}/feed`} className="text-foreground transition-colors hover:text-primary">{dict.nav.feed}</Link>
          <Link href={`/${locale}/profile/narin.drives`} className="text-muted-foreground transition-colors hover:text-primary">{dict.nav.garage}</Link>
          <Link href={`/${locale}/profile/narin.drives`} className="text-muted-foreground transition-colors hover:text-primary">{dict.nav.profile}</Link>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <LocaleSwitcher locale={locale} />
          <Button size="icon" variant="ghost" className="hidden sm:inline-flex" aria-label="Notifications"><Bell className="size-4" /></Button>
          <Button asChild size="sm" className="gap-2 rounded-full px-4">
            <Link href={`/${locale}/post/new`}><Plus className="size-4" /><span className="hidden sm:inline">{dict.nav.newPost}</span></Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
