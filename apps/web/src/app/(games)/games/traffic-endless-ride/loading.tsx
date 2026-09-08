import { GameSkeleton } from "@/features/loading/components/page-skeletons";
import { getRequestLocale } from "@/lib/request-locale";

export default async function TrafficEndlessRideLoading() {
  const locale = await getRequestLocale();
  return <GameSkeleton locale={locale} />;
}
