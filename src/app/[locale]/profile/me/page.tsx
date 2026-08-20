import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertLocale } from "@/lib/i18n";

export default async function MyProfilePage({ params }: { params: Promise<{ locale: string }> }) { const locale = assertLocale((await params).locale); if (!isSupabaseConfigured()) redirect(`/${locale}/profile/narin.drives`); const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect(`/${locale}/auth`); const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(); redirect(data?.username ? `/${locale}/profile/${data.username}` : `/${locale}/settings/profile`); }
