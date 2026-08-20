import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getLocale } from "@/lib/i18n-server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getViewerContext } from "@/lib/data";
import { safeNextPath } from "@/lib/auth-redirect";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in" };

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const locale = await getLocale();
  const nextPath = safeNextPath((await searchParams).next);
  const viewer = await getViewerContext();
  if (viewer) redirect(viewer.onboardingCompleted ? nextPath : "/settings/profile");
  return <main className="relative grid min-h-screen place-items-center px-4 py-12"><div className="absolute right-4 top-4"><LocaleSwitcher /></div><div className="absolute left-0 top-0 -z-10 size-72 rounded-full bg-primary/10 blur-3xl" /><AuthForm locale={locale} configured={isSupabaseConfigured()} nextPath={nextPath} /></main>;
}
