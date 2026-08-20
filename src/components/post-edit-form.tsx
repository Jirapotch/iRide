"use client";

import { useActionState } from "react";
import { updatePostAction } from "@/app/actions";
import { ImageUploadHint } from "@/components/image-upload-hint";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState, Locale, Post, Vehicle } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function PostEditForm({ post, vehicles, locale, returnTo }: { post: Post; vehicles: Vehicle[]; locale: Locale; returnTo: string }) {
  const [state, action, pending] = useActionState(updatePostAction.bind(null, post.id, returnTo), initialState);
  return <form action={action} className="space-y-5" aria-busy={pending}>
    <div className="space-y-2"><Label htmlFor="body">{locale === "th" ? "เรื่องราว" : "Story"}</Label><Textarea id="body" name="body" defaultValue={post.body} rows={7} maxLength={1200} required aria-invalid={Boolean(state.fieldErrors?.body)} />{state.fieldErrors?.body?.[0] && <p className="text-sm text-destructive">{state.fieldErrors.body[0]}</p>}</div>
    <div className="space-y-2"><Label htmlFor="vehicleId">{locale === "th" ? "Vehicle ที่เกี่ยวข้อง" : "Vehicle"}</Label><Select name="vehicleId" defaultValue={post.vehicle?.id ?? "none"}><SelectTrigger id="vehicleId" className="min-h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{locale === "th" ? "ไม่ผูกกับ Vehicle" : "No vehicle"}</SelectItem>{vehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{[vehicle.name, vehicle.brand, vehicle.model].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label htmlFor="photo">{locale === "th" ? "เปลี่ยนรูปภาพ (ไม่บังคับ)" : "Replace photo (optional)"}</Label><Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="min-h-11" /><ImageUploadHint locale={locale} />{post.photoUrl && <p className="text-xs text-muted-foreground">{locale === "th" ? "หากไม่เลือกรูปใหม่ ระบบจะเก็บรูปเดิมไว้" : "Leave empty to keep the current photo."}</p>}</div>
    {state.message && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{state.message}</p>}
    <SubmitButton className="min-h-11 w-full sm:w-auto" idleLabel={locale === "th" ? "บันทึกโพสต์" : "Save post"} pendingLabel={locale === "th" ? "กำลังบันทึก…" : "Saving…"} />
  </form>;
}
