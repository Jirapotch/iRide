import { createVehicleAction } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLocale } from "@/lib/i18n-server";

export default async function NewVehiclePage() { const locale = await getLocale(); return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-2xl px-4 py-10"><Card className="surface-shadow border-white/70"><CardHeader><CardTitle>{locale === "th" ? "เพิ่ม Vehicle เข้า Garage" : "Add a vehicle to your garage"}</CardTitle><CardDescription>{locale === "th" ? "กรอกชื่อก่อน ส่วนข้อมูลอื่นเพิ่มภายหลังได้" : "Start with a name. Everything else is optional."}</CardDescription></CardHeader><CardContent><form action={createVehicleAction} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Name" name="name" placeholder="Mochi" required /><Field label="Brand" name="brand" placeholder="Mazda" /><Field label="Model" name="model" placeholder="MX-5 RF" /><Field label="Color" name="color" placeholder="Snowflake White" /></div><div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" rows={4} maxLength={300} /></div><div className="space-y-2"><Label htmlFor="cover">Cover photo</Label><Input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" /></div><Button>{locale === "th" ? "เพิ่ม Vehicle" : "Add vehicle"}</Button></form></CardContent></Card></main></>; }
function Field({ label, name, placeholder, required = false }: { label: string; name: string; placeholder?: string; required?: boolean }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} placeholder={placeholder} required={required} /></div>; }
