"use client";

import { useActionState } from "react";
import { createVehicleAction } from "@/app/actions";
import { ImageUploadHint } from "@/components/image-upload-hint";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState, Locale } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function NewVehicleForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(createVehicleAction, initialState);
  return <form action={action} className="space-y-5" aria-busy={pending}>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" name="name" placeholder="Mochi" required error={state.fieldErrors?.name?.[0]} />
      <Field label="Brand" name="brand" placeholder="Mazda" error={state.fieldErrors?.brand?.[0]} />
      <Field label="Model" name="model" placeholder="MX-5 RF" error={state.fieldErrors?.model?.[0]} />
      <Field label="Year" name="year" type="number" placeholder="2025" error={state.fieldErrors?.year?.[0]} />
      <Field label="Trim" name="trim" placeholder="RS" error={state.fieldErrors?.trim?.[0]} />
      <Field label="Color" name="color" placeholder="Snowflake White" error={state.fieldErrors?.color?.[0]} />
    </div>
    <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" rows={4} maxLength={300} aria-invalid={Boolean(state.fieldErrors?.description)} />{state.fieldErrors?.description?.[0] && <p className="text-sm text-destructive">{state.fieldErrors.description[0]}</p>}</div>
    <div className="space-y-2"><Label htmlFor="cover">Cover photo</Label><Input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="min-h-11" /><ImageUploadHint locale={locale} /></div>
    {state.message && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{state.message}</p>}
    <SubmitButton className="min-h-11 w-full sm:w-auto" idleLabel={locale === "th" ? "เพิ่ม Vehicle" : "Add vehicle"} pendingLabel={locale === "th" ? "กำลังเพิ่ม…" : "Adding…"} />
  </form>;
}

function Field({ label, name, placeholder, required = false, type = "text", error }: { label: string; name: string; placeholder?: string; required?: boolean; type?: string; error?: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} placeholder={placeholder} required={required} className="min-h-11" aria-invalid={Boolean(error)} />{error && <p className="text-sm text-destructive">{error}</p>}</div>;
}
