import { getRequestLocale } from "@/lib/request-locale";

import { SearchScreen } from "../_components/search-screen";

export default async function SearchPage() {
  return <SearchScreen locale={await getRequestLocale()} />;
}
