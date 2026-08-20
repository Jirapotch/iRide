import { redirect } from "next/navigation";

export default async function LegacyAuthPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next;
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
}
