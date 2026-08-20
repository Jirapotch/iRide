"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { persistLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/types";

export function LegacyLocaleRedirect({ locale, destination }: { locale: Locale; destination: string }) {
  const router = useRouter();

  useEffect(() => {
    persistLocale(locale);
    router.replace(destination);
  }, [destination, locale, router]);

  return <main className="grid min-h-screen place-items-center px-4 text-center"><p className="text-sm text-muted-foreground">{locale === "th" ? "กำลังเปิดหน้าที่ต้องการ…" : "Opening your page…"}</p></main>;
}
