import {
  Bicycle,
  Car,
  ChatCircle,
  Motorcycle,
} from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";
import { resolveBreadcrumbs } from "@/lib/app-navigation-domain";
import { getRequestLocale } from "@/lib/request-locale";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { PendingLink } from "../../_components/pending-link";
import { CommunityFeedPage } from "../../_components/community-feed-page";
import { CommunityCategory } from "@iride/types";

const vehicles = {
  car: { th: "รถยนต์", en: "Cars", icon: Car },
  motorcycle: { th: "มอเตอร์ไซค์", en: "Motorcycles", icon: Motorcycle },
  bicycle: { th: "จักรยาน", en: "Bicycles", icon: Bicycle },
} as const;

export default async function VehicleCommunityPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly vehicle: string }>;
  readonly searchParams: Promise<{
    readonly modal?: string;
    readonly post?: string;
  }>;
}) {
  const [{ vehicle }, locale] = await Promise.all([params, getRequestLocale()]);
  if (!(vehicle in vehicles)) notFound();
  const item = vehicles[vehicle as keyof typeof vehicles];
  const Icon = item.icon;
  const category = vehicle as Extract<
    CommunityCategory,
    "car" | "motorcycle" | "bicycle"
  >;
  const breadcrumbs = resolveBreadcrumbs(`/community/${vehicle}`, { locale });

  return (
    <main className="community-section-page">
      <Breadcrumbs items={breadcrumbs} locale={locale} />
      <header>
        <Icon size={44} weight="duotone" />
        <h1 data-route-heading tabIndex={-1}>
          {item[locale]}
        </h1>
      </header>
      <CommunityFeedPage
        category={category}
        room="talk"
        searchParams={searchParams}
      />
    </main>
  );
}
