import { AppHeader } from "@/components/app-header";
import { ProfileForm } from "@/components/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { demoProfile } from "@/lib/demo-data";
import { assertLocale } from "@/lib/i18n";

export default async function ProfileSettingsPage({ params }: { params: Promise<{ locale: string }> }) { const locale = assertLocale((await params).locale); return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-2xl px-4 py-10"><Card className="surface-shadow border-white/70"><CardHeader><CardTitle>{locale === "th" ? "ตั้งค่าโปรไฟล์" : "Profile settings"}</CardTitle><CardDescription>{locale === "th" ? "ข้อมูลนี้จะแสดงในโปรไฟล์สาธารณะของคุณ" : "This information appears on your public profile."}</CardDescription></CardHeader><CardContent><ProfileForm locale={locale} profile={demoProfile} /></CardContent></Card></main></>; }
