import type { Locale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";

import { LanguageSwitcher } from "./language-switcher";

const content: Record<
  Locale,
  { eyebrow: string; title: string; description: string }
> = {
  th: {
    eyebrow: "iRide กำลังเริ่มต้น",
    title: "ทุกเรื่องราว เริ่มจากการออกเดินทาง",
    description: "พื้นที่สำหรับคนรักรถ เส้นทาง และชุมชนที่พบกันระหว่างทาง",
  },
  en: {
    eyebrow: "iRide is getting ready",
    title: "Every story starts with a drive",
    description:
      "A home for people who care about cars, roads, and the communities along the way.",
  },
};

export default async function HomePage() {
  const locale = await getRequestLocale();
  const copy = content[locale];

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
        <LanguageSwitcher locale={locale} returnTo="/" />
      </div>
    </main>
  );
}
