import { redirect } from "next/navigation";
import { legacyCommunityHref } from "@/lib/app-navigation-domain";

export default async function LegacyCommunityPage({ searchParams }: { readonly searchParams: Promise<{ readonly room?: string; readonly post?: string; readonly modal?: string }> }) {
  const query = await searchParams;
  if (query.room === "market" || query.room === "photographers") redirect("/");
  redirect(legacyCommunityHref(query.room, query));
}
