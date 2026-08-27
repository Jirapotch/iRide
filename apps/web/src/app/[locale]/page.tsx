import { buttonVariants } from "@iride/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isLocale, locales, type Locale } from "@/lib/locale";

const content: Record<
  Locale,
  { eyebrow: string; title: string; description: string; switchLabel: string }
> = {
  th: {
    eyebrow: "iRide กำลังเริ่มต้น",
    title: "ทุกเรื่องราว เริ่มจากการออกเดินทาง",
    description: "พื้นที่สำหรับคนรักรถ เส้นทาง และชุมชนที่พบกันระหว่างทาง",
    switchLabel: "English",
  },
  en: {
    eyebrow: "iRide is getting ready",
    title: "Every story starts with a drive",
    description:
      "A home for people who care about cars, roads, and the communities along the way.",
    switchLabel: "ภาษาไทย",
  },
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const copy = content[locale];
  const alternateLocale = locale === "th" ? "en" : "th";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16 sm:px-10">
      <div className="space-y-5">
        <p className="font-mono text-sm font-medium uppercase tracking-[0.18em] text-primary">
          {copy.eyebrow}
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
          {copy.title}
        </h1>
        <p className="max-w-xl text-lg leading-8 text-muted-foreground">
          {copy.description}
        </p>
      </div>
      <div>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`/${alternateLocale}`}
          hrefLang={alternateLocale}
        >
          {copy.switchLabel}
        </Link>
      </div>
    </main>
  );
}
