import { createVehicleAction } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { BackButton } from "@/components/back-button";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLocale } from "@/lib/i18n-server";

export default async function NewVehiclePage() {
  const locale = await getLocale();
  return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-2xl px-4 py-5 sm:py-8"><BackButton fallbackHref="/profile/me#garage" label={locale === "th" ? "กลับไปที่ Garage" : "Back to garage"} /><Card className="surface-shadow mt-2 border-white/70"><CardHeader><CardTitle>{locale === "th" ? "เพิ่ม Vehicle เข้า Garage" : "Add a vehicle to your garage"}</CardTitle><CardDescription>{locale === "th" ? "กรอกชื่อก่อน ส่วนข้อมูลอื่นเพิ่มภายหลังได้" : "Start with a name. Everything else is optional."}</CardDescription></CardHeader><CardContent><form action={createVehicleAction} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Name" name="name" placeholder="Mochi" required /><Field label="Brand" name="brand" placeholder="Mazda" /><Field label="Model" name="model" placeholder="MX-5 RF" /><Field label="Year" name="year" type="number" placeholder="2025" /><Field label="Trim" name="trim" placeholder="RS" /><Field label="Color" name="color" placeholder="Snowflake White" /></div><div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" rows={4} maxLength={300} /></div><div className="space-y-2"><Label htmlFor="cover">Cover photo</Label><Input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="min-h-11" /></div><SubmitButton className="min-h-11 w-full sm:w-auto" idleLabel={locale === "th" ? "เพิ่ม Vehicle" : "Add vehicle"} pendingLabel={locale === "th" ? "กำลังเพิ่ม…" : "Adding…"} /></form></CardContent></Card></main></>;
}

function Field({ label, name, placeholder, required = false, type = "text" }: { label: string; name: string; placeholder?: string; required?: boolean; type?: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} placeholder={placeholder} required={required} className="min-h-11" /></div>;
}
