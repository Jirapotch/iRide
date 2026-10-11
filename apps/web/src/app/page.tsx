import { GarageHub } from "@/features/hub/garage-hub";
import { getRequestLocale } from "@/lib/request-locale";
export default async function Home() {
  return <GarageHub locale={await getRequestLocale()} />;
}
