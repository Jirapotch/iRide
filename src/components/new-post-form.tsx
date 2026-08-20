"use client";

import { useActionState } from "react";
import { ImagePlus } from "lucide-react";
import { createPostAction } from "@/app/actions";
import { ImageUploadHint } from "@/components/image-upload-hint";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState, Locale, Vehicle } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function NewPostForm({ locale, vehicles }: { locale: Locale; vehicles: Vehicle[] }) {
  const [state, action, pending] = useActionState(createPostAction, initialState);
  return <form action={action} className="space-y-5" aria-busy={pending}>
    <div className="space-y-2"><Label htmlFor="body">{locale === "th" ? "เรื่องราว" : "Story"}</Label><Textarea id="body" name="body" rows={6} maxLength={1200} placeholder={locale === "th" ? "วันนี้ Vehicle ของคุณพาไปไหนมา?" : "Where did your vehicle take you today?"} required aria-invalid={Boolean(state.fieldErrors?.body)} />{state.fieldErrors?.body?.[0] && <p className="text-sm text-destructive">{state.fieldErrors.body[0]}</p>}</div>
    <div className="space-y-2"><Label htmlFor="vehicleId">{locale === "th" ? "Vehicle ที่เกี่ยวข้อง (ไม่บังคับ)" : "Vehicle (optional)"}</Label><Select name="vehicleId"><SelectTrigger id="vehicleId" className="min-h-11 w-full"><SelectValue placeholder={locale === "th" ? "เลือก Vehicle จาก Garage" : "Choose from your garage"} /></SelectTrigger><SelectContent>{vehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{[vehicle.name, vehicle.brand, vehicle.model].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent></Select>{state.fieldErrors?.vehicleId?.[0] && <p className="text-sm text-destructive">{state.fieldErrors.vehicleId[0]}</p>}</div>
    <div className="space-y-2"><Label htmlFor="photo">{locale === "th" ? "รูปภาพ" : "Photo"}</Label><div className="rounded-2xl border border-dashed bg-muted/30 p-5"><ImagePlus className="mb-3 size-7 text-primary" /><Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="min-h-11" /><ImageUploadHint locale={locale} /></div></div>
    {state.message && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{state.message}</p>}
    <SubmitButton className="min-h-11 w-full sm:w-auto" idleLabel={locale === "th" ? "เผยแพร่เรื่องราว" : "Publish story"} pendingLabel={locale === "th" ? "กำลังเผยแพร่…" : "Publishing…"} />
  </form>;
}
