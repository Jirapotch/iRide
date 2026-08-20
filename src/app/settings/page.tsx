import { redirect } from "next/navigation";
import { Check, LockKeyhole, UserRoundX } from "lucide-react";
import { respondToFollowRequestAction, updatePrivacyAction } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { LanguageSettings } from "@/components/settings-controls";
import { IconSubmitButton, SubmitButton } from "@/components/submit-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyProfile, getPendingFollowRequests, getViewerContext } from "@/lib/data";
import { getLocale } from "@/lib/i18n-server";
import { initials } from "@/lib/profile-utils";

export default async function SettingsPage() {
  const [locale, viewer] = await Promise.all([getLocale(), getViewerContext()]);
  if (!viewer) redirect(`/login?next=${encodeURIComponent("/settings")}`);
  if (!viewer.onboardingCompleted) redirect("/settings/profile");
  const [profile, requests] = await Promise.all([getMyProfile(), getPendingFollowRequests()]);
  if (!profile) redirect("/settings/profile");
  const thai = locale === "th";

  return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
    <div><h1 className="text-3xl font-bold">{thai ? "ตั้งค่า" : "Settings"}</h1><p className="mt-1 text-muted-foreground">{thai ? "จัดการความเป็นส่วนตัวและภาษาของคุณ" : "Manage your privacy and language."}</p></div>
    <Card className="surface-shadow border-white/70"><CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="size-5 text-primary" />{thai ? "ความเป็นส่วนตัว" : "Privacy"}</CardTitle><CardDescription>{thai ? "บัญชีส่วนตัวจะแสดง Vehicle และโพสต์ให้เฉพาะผู้ติดตามที่คุณอนุมัติ" : "A private account shows vehicles and posts only to followers you approve."}</CardDescription></CardHeader><CardContent><form action={updatePrivacyAction} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><Label htmlFor="isPrivate" className="text-base">{thai ? "บัญชีส่วนตัว" : "Private account"}</Label><p className="mt-1 text-sm text-muted-foreground">{thai ? "ข้อมูลโปรไฟล์พื้นฐานยังคงมองเห็นได้" : "Basic profile information remains visible."}</p></div><div className="flex items-center gap-3"><Input id="isPrivate" name="isPrivate" type="checkbox" defaultChecked={profile.isPrivate} className="size-6" /><SubmitButton className="min-h-11" idleLabel={thai ? "บันทึก" : "Save"} pendingLabel={thai ? "กำลังบันทึก…" : "Saving…"} /></div></form></CardContent></Card>
    <Card className="surface-shadow border-white/70"><CardHeader><CardTitle>{thai ? "ภาษา" : "Language"}</CardTitle><CardDescription>{thai ? "การตั้งค่านี้จะใช้กับบัญชีของคุณ" : "This preference follows your account."}</CardDescription></CardHeader><CardContent><LanguageSettings locale={locale} /></CardContent></Card>
    <Card className="surface-shadow border-white/70"><CardHeader><CardTitle>{thai ? "คำขอติดตาม" : "Follow requests"}</CardTitle><CardDescription>{thai ? `${requests.length} คำขอที่รอการตอบรับ` : `${requests.length} pending request${requests.length === 1 ? "" : "s"}`}</CardDescription></CardHeader><CardContent className="space-y-3">{requests.length ? requests.map((request) => <div key={request.followerId} className="flex items-center gap-3 rounded-xl border p-3"><Avatar><AvatarImage src={request.avatarUrl ?? undefined} alt={request.displayName} /><AvatarFallback>{initials(request.displayName)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate font-medium">{request.displayName}</p><p className="truncate text-sm text-muted-foreground">@{request.username}</p></div><form action={respondToFollowRequestAction.bind(null, request.followerId, "accept")}><IconSubmitButton label={thai ? "อนุมัติคำขอ" : "Accept request"}><Check className="size-4" /></IconSubmitButton></form><form action={respondToFollowRequestAction.bind(null, request.followerId, "reject")}><IconSubmitButton variant="outline" label={thai ? "ปฏิเสธคำขอ" : "Reject request"}><UserRoundX className="size-4" /></IconSubmitButton></form></div>) : <p className="py-6 text-center text-sm text-muted-foreground">{thai ? "ยังไม่มีคำขอติดตาม" : "No pending follow requests."}</p>}</CardContent></Card>
  </main></>;
}
