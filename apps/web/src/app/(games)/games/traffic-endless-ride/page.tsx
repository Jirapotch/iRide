import { TrafficEndlessRideGame } from "../_components/traffic-endless-ride-game";
import { getRequestLocale } from "@/lib/request-locale";
export const metadata = { title: "Traffic Endless Ride" };
export default async function GamePage() {
  return <TrafficEndlessRideGame locale={await getRequestLocale()} />;
}
