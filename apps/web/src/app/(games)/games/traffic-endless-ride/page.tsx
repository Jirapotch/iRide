import type { Metadata } from "next";

import { getRequestLocale } from "@/lib/request-locale";

import { TrafficEndlessRideGame } from "../_components/traffic-endless-ride-game";

export const metadata: Metadata = {
  title: "Traffic Endless Ride | iRide",
  description: "Choose a ride and weave through endless traffic.",
};

export default async function TrafficEndlessRidePage() {
  const locale = await getRequestLocale();
  return <TrafficEndlessRideGame locale={locale} />;
}
