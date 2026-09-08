import { GamesSkeleton } from "@/features/loading/components/page-skeletons";
import { getRequestLocale } from "@/lib/request-locale";

export default async function GamesLoading() {
  const locale = await getRequestLocale();
  return <GamesSkeleton locale={locale} />;
}
