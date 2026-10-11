import type { Metadata } from "next";
import { GarageScreen } from "@/features/garage/garage-screen";
import { getRequestLocale } from "@/lib/request-locale";
export const metadata: Metadata = { title: "Garage" };
export default async function GaragePage() {
  return <GarageScreen locale={await getRequestLocale()} />;
}
