import { notFound } from "next/navigation";
import { getRequestLocale } from "@/lib/request-locale";
import { PhotographerScreen } from "../../_components/demo-screens";
export default async function PhotographerPage({ params }: { readonly params: Promise<{ username: string }> }) {
  const [{ username }, locale] = await Promise.all([params, getRequestLocale()]);
  if (!["wander-lens", "maya-velocity"].includes(username)) notFound();
  return <PhotographerScreen locale={locale} />;
}
