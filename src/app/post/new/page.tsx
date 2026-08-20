import { AppHeader } from "@/components/app-header";
import { BackButton } from "@/components/back-button";
import { NewPostForm } from "@/components/new-post-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyVehicles } from "@/lib/data";
import { getLocale } from "@/lib/i18n-server";

export default async function NewPostPage() {
  const [locale, vehicles] = await Promise.all([getLocale(), getMyVehicles()]);
  return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-2xl px-4 py-5 sm:py-8"><BackButton fallbackHref="/" label={locale === "th" ? "กลับไปที่ Feed" : "Back to feed"} /><Card className="surface-shadow mt-2 border-white/70"><CardHeader><CardTitle>{locale === "th" ? "เล่าเรื่องการเดินทาง" : "Share a ride story"}</CardTitle><CardDescription>{locale === "th" ? "หนึ่งรูป หนึ่งเรื่องราวจากคุณ" : "One photo. One story from the road."}</CardDescription></CardHeader><CardContent><NewPostForm locale={locale} vehicles={vehicles} /></CardContent></Card></main></>;
}
