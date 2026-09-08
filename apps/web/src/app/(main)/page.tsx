import { getRequestLocale } from "@/lib/request-locale";
import { HomeDiscovery } from "@/features/home/components/home-discovery";

export default async function HomePage() {
  const locale = await getRequestLocale();
  return <HomeDiscovery locale={locale} />;
}
