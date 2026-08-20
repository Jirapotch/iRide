import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ProfileForm } from "@/components/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyProfile, getViewerContext } from "@/lib/data";
import { getLocale } from "@/lib/i18n-server";
import type { Profile } from "@/lib/types";

export default async function ProfileSettingsPage() {
  const [locale, viewer] = await Promise.all([getLocale(), getViewerContext()]);
  if (!viewer) redirect(`/auth?next=${encodeURIComponent("/settings/profile")}`);
  const stored = await getMyProfile();
  const profile: Profile = stored ?? { id: viewer.id, username: viewer.username ?? `driver.${viewer.id.replaceAll("-", "").slice(0, 23)}`, displayName: viewer.displayName, bio: null, location: null, avatarUrl: viewer.avatarUrl, coverUrl: null, locale, isPrivate: false, followersCount: 0, followingCount: 0 };
  return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-2xl px-4 py-10"><Card className="surface-shadow border-white/70"><CardHeader><CardTitle>{locale === "th" ? "ตั้งค่าโปรไฟล์" : "Profile settings"}</CardTitle><CardDescription>{locale === "th" ? "ยืนยันข้อมูลของคุณก่อนเริ่มใช้งาน iRide" : "Confirm your details before using iRide."}</CardDescription></CardHeader><CardContent><ProfileForm locale={locale} profile={profile} /></CardContent></Card></main></>;
}
