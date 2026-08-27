import { getRequestLocale } from "@/lib/request-locale";
import { MarketScreen } from "../_components/demo-screens";
export default async function MarketPage() { return <MarketScreen locale={await getRequestLocale()} />; }
