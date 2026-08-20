"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  const nextLocale = locale === "th" ? "en" : "th";
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2"
      aria-label={locale === "th" ? "Switch to English (EN)" : "เปลี่ยนเป็นภาษาไทย (TH)"}
      onClick={() => setLocale(nextLocale)}
    >
      <Languages className="size-4" />
      {nextLocale.toUpperCase()}
    </Button>
  );
}
