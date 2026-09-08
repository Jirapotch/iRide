import { MapSkeleton } from "@/features/loading/components/page-skeletons";
import { getRequestLocale } from "@/lib/request-locale";

export default async function MapsLoading() {
  const locale = await getRequestLocale();
  return <MapSkeleton locale={locale} />;
}
