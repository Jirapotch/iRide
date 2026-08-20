import { notFound } from "next/navigation";
import { LegacyLocaleRedirect } from "@/components/legacy-locale-redirect";
import { isLocale } from "@/lib/i18n";

type SearchParams = Record<string, string | string[] | undefined>;

function buildDestination(path: string[] | undefined, searchParams: SearchParams) {
  const pathname = path?.length ? `/${path.map(encodeURIComponent).join("/")}` : "/";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

export default async function LegacyLocalePage({ params, searchParams }: {
  params: Promise<{ locale: string; path?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ locale, path }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  return <LegacyLocaleRedirect locale={locale} destination={buildDestination(path, query)} />;
}
