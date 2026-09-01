import { Bicycle, Car, ChatCircle, Motorcycle, Storefront } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "@/lib/request-locale";

const vehicles = { car: { th: "รถยนต์", en: "Cars", icon: Car }, motorcycle: { th: "มอเตอร์ไซค์", en: "Motorcycles", icon: Motorcycle }, bicycle: { th: "จักรยาน", en: "Bicycles", icon: Bicycle } } as const;

export default async function VehicleCommunityPage({ params }: { readonly params: Promise<{ readonly vehicle: string }> }) {
  const [{ vehicle }, locale] = await Promise.all([params, getRequestLocale()]);
  if (!(vehicle in vehicles)) notFound();
  const item = vehicles[vehicle as keyof typeof vehicles];
  const Icon = item.icon;
  return <main className="community-section-page"><header><Icon size={44} weight="duotone" /><h1>{item[locale]}</h1></header><div className="community-room-grid"><Link href={`/community/${vehicle}/talk`}><ChatCircle size={34} weight="duotone" /><strong>{locale === "th" ? "พูดคุย" : "Talk"}</strong><span>{locale === "th" ? "แชร์เรื่องราวและประสบการณ์" : "Share stories and experience"}</span></Link><Link href={`/community/${vehicle}/market`}><Storefront size={34} weight="duotone" /><strong>Market</strong><span>{locale === "th" ? "พื้นที่ซื้อขายสำหรับหมวดนี้" : "Marketplace for this category"}</span></Link></div></main>;
}
