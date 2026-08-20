"use client";

import { useActionState } from "react";
import { updateVehicleAction } from "@/app/actions";
import { ImageUploadHint } from "@/components/image-upload-hint";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState, Locale, Vehicle } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function VehicleEditForm({ vehicle, locale, returnTo }: { vehicle: Vehicle; locale: Locale; returnTo: string }) {
  const [state, action, pending] = useActionState(updateVehicleAction.bind(null, vehicle.id, returnTo), initialState);
  return <form action={action} className="space-y-5" aria-busy={pending}>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" name="name" defaultValue={vehicle.name} required error={state.fieldErrors?.name?.[0]} />
      <Field label="Brand" name="brand" defaultValue={vehicle.brand} error={state.fieldErrors?.brand?.[0]} />
      <Field label="Model" name="model" defaultValue={vehicle.model} error={state.fieldErrors?.model?.[0]} />
      <Field label="Year" name="year" type="number" defaultValue={vehicle.year} error={state.fieldErrors?.year?.[0]} />
      <Field label="Trim" name="trim" defaultValue={vehicle.trim} error={state.fieldErrors?.trim?.[0]} />
      <Field label="Color" name="color" defaultValue={vehicle.color} error={state.fieldErrors?.color?.[0]} />
    </div>
    <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" defaultValue={vehicle.description ?? ""} rows={4} maxLength={300} /></div>
    <div className="space-y-2"><Label htmlFor="cover">{locale === "th" ? "เปลี่ยนรูปหน้าปก (ไม่บังคับ)" : "Replace cover (optional)"}</Label><Input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="min-h-11" /><ImageUploadHint locale={locale} />{vehicle.coverUrl && <p className="text-xs text-muted-foreground">{locale === "th" ? "หากไม่เลือกรูปใหม่ ระบบจะเก็บรูปเดิมไว้" : "Leave empty to keep the current cover."}</p>}</div>
    {state.message && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{state.message}</p>}
    <SubmitButton className="min-h-11 w-full sm:w-auto" idleLabel={locale === "th" ? "บันทึก Vehicle" : "Save vehicle"} pendingLabel={locale === "th" ? "กำลังบันทึก…" : "Saving…"} />
  </form>;
}

function Field({ label, name, defaultValue, required = false, type = "text", error }: { label: string; name: string; defaultValue: string | number | null; required?: boolean; type?: string; error?: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} className="min-h-11" aria-invalid={Boolean(error)} />{error && <p className="text-sm text-destructive">{error}</p>}</div>;
}
