"use client";

import { Languages } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/types";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const nextLocale = locale === "th" ? "en" : "th";
  const nextPath = pathname.replace(/^\/(th|en)(?=\/|$)/, `/${nextLocale}`);
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="gap-2"
    >
      <Link href={nextPath} onClick={() => { document.cookie = `iride-locale=${nextLocale};path=/;max-age=31536000;samesite=lax`; }}>
        <Languages className="size-4" />
        {nextLocale.toUpperCase()}
      </Link>
    </Button>
  );
}
