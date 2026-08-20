"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState, Locale, Profile } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function ProfileForm({ locale, profile }: { locale: Locale; profile?: Profile }) {
  const [state, action, pending] = useActionState(updateProfileAction, initialState);
  return <form action={action} className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><Field label="Username" name="username" defaultValue={profile?.username} error={state.fieldErrors?.username?.[0]} /><Field label={locale === "th" ? "ชื่อที่แสดง" : "Display name"} name="displayName" defaultValue={profile?.displayName} error={state.fieldErrors?.displayName?.[0]} /></div><div className="space-y-2"><Label htmlFor="bio">Bio</Label><Textarea id="bio" name="bio" defaultValue={profile?.bio ?? ""} maxLength={180} rows={4} /></div><Field label={locale === "th" ? "สถานที่" : "Location"} name="location" defaultValue={profile?.location ?? ""} /><div className="space-y-2"><Label htmlFor="avatar">Avatar</Label><Input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" /></div>{state.message && <p role="status" className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>}<Button disabled={pending}>{pending ? (locale === "th" ? "กำลังบันทึก…" : "Saving…") : (locale === "th" ? "บันทึกโปรไฟล์" : "Save profile")}</Button></form>;
}

function Field({ label, name, defaultValue, error }: { label: string; name: string; defaultValue?: string | null; error?: string }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input key={`${name}:${defaultValue ?? ""}`} id={name} name={name} defaultValue={defaultValue ?? ""} aria-invalid={Boolean(error)} />{error && <p className="text-xs text-destructive">{error}</p>}</div>; }
