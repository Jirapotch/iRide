import { ImagePlus } from "lucide-react";
import { createPostAction } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { BackButton } from "@/components/back-button";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getMyVehicles } from "@/lib/data";
import { getLocale } from "@/lib/i18n-server";

export default async function NewPostPage() {
  const [locale, vehicles] = await Promise.all([getLocale(), getMyVehicles()]);
  return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-2xl px-4 py-5 sm:py-8"><BackButton fallbackHref="/" label={locale === "th" ? "กลับไปที่ Feed" : "Back to feed"} /><Card className="surface-shadow mt-2 border-white/70"><CardHeader><CardTitle>{locale === "th" ? "เล่าเรื่องการเดินทาง" : "Share a ride story"}</CardTitle><CardDescription>{locale === "th" ? "หนึ่งรูป หนึ่งเรื่องราวจากคุณ" : "One photo. One story from the road."}</CardDescription></CardHeader><CardContent><form action={createPostAction} className="space-y-5"><div className="space-y-2"><Label htmlFor="body">{locale === "th" ? "เรื่องราว" : "Story"}</Label><Textarea id="body" name="body" rows={6} maxLength={1200} placeholder={locale === "th" ? "วันนี้ Vehicle ของคุณพาไปไหนมา?" : "Where did your vehicle take you today?"} required /></div><div className="space-y-2"><Label htmlFor="vehicleId">{locale === "th" ? "Vehicle ที่เกี่ยวข้อง (ไม่บังคับ)" : "Vehicle (optional)"}</Label><Select name="vehicleId"><SelectTrigger id="vehicleId" className="min-h-11 w-full"><SelectValue placeholder={locale === "th" ? "เลือก Vehicle จาก Garage" : "Choose from your garage"} /></SelectTrigger><SelectContent>{vehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{[vehicle.name, vehicle.brand, vehicle.model].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="photo">{locale === "th" ? "รูปภาพ" : "Photo"}</Label><div className="rounded-2xl border border-dashed bg-muted/30 p-5"><ImagePlus className="mb-3 size-7 text-primary" /><Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="min-h-11" /><p className="mt-2 text-xs text-muted-foreground">JPEG, PNG or WebP · max 8 MB</p></div></div><SubmitButton className="min-h-11 w-full sm:w-auto" idleLabel={locale === "th" ? "เผยแพร่เรื่องราว" : "Publish story"} pendingLabel={locale === "th" ? "กำลังเผยแพร่…" : "Publishing…"} /></form></CardContent></Card></main></>;
}
