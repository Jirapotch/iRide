import type { CommunityCategory } from "@iride/types";
import { notFound } from "next/navigation";
import { CommunityFeedPage } from "../../../_components/community-feed-page";

const labels = { car: { th: "พูดคุยเรื่องรถยนต์", en: "Car talk" }, motorcycle: { th: "พูดคุยเรื่องมอเตอร์ไซค์", en: "Motorcycle talk" }, bicycle: { th: "พูดคุยเรื่องจักรยาน", en: "Bicycle talk" } } as const;

export default async function VehicleTalkPage({ params, searchParams }: { readonly params: Promise<{ readonly vehicle: string }>; readonly searchParams: Promise<{ readonly modal?: string; readonly post?: string }> }) {
  const { vehicle } = await params;
  if (!(vehicle in labels)) notFound();
  const category = vehicle as Extract<CommunityCategory, "car" | "motorcycle" | "bicycle">;
  return <CommunityFeedPage category={category} heading={labels[category]} room="talk" searchParams={searchParams} />;
}
