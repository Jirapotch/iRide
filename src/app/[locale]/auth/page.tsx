import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { assertLocale } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Sign in" };

export default async function AuthPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  return <main className="relative grid min-h-screen place-items-center px-4 py-12"><div className="absolute right-4 top-4"><LocaleSwitcher locale={locale} /></div><div className="absolute left-0 top-0 -z-10 size-72 rounded-full bg-primary/10 blur-3xl" /><AuthForm locale={locale} configured={isSupabaseConfigured()} /></main>;
}
