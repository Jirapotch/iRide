import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { safeNextPath } from "@/lib/auth-redirect";
import { getViewerContext } from "@/lib/data";
import { getLocale } from "@/lib/i18n-server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const locale = await getLocale();
  const nextPath = safeNextPath((await searchParams).next);
  const viewer = await getViewerContext();
  if (viewer) redirect(viewer.onboardingCompleted ? nextPath : "/settings/profile");
  return <main className="relative grid min-h-screen place-items-center px-4 py-12"><div className="absolute left-0 top-0 -z-10 size-72 rounded-full bg-primary/10 blur-3xl" /><AuthForm locale={locale} configured={isSupabaseConfigured()} nextPath={nextPath} /></main>;
}
