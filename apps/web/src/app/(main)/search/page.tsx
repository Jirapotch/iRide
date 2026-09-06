import { getRequestLocale } from "@/lib/request-locale";

import { SearchScreen } from "../_components/search-screen";

export default async function SearchPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string }>;
}) {
  const [locale, query] = await Promise.all([getRequestLocale(), searchParams]);
  return (
    <SearchScreen initialQuery={query.q?.slice(0, 100) ?? ""} locale={locale} />
  );
}
