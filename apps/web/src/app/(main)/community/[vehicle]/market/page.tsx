import { Storefront } from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";
import { getRequestLocale } from "@/lib/request-locale";

export default async function VehicleMarketPage({ params }: { readonly params: Promise<{ readonly vehicle: string }> }) {
  const [{ vehicle }, locale] = await Promise.all([params, getRequestLocale()]);
  if (!new Set(["car", "motorcycle", "bicycle"]).has(vehicle)) notFound();
  return <main className="coming-soon-page"><Storefront size={48} weight="duotone" /><h1>Market</h1><strong>Coming soon</strong><p>{locale === "th" ? "ฟีเจอร์ซื้อขายกำลังอยู่ระหว่างการพัฒนา" : "Marketplace features are in development."}</p></main>;
}
