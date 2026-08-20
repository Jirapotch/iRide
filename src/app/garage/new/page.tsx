import { createVehicleAction } from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLocale } from "@/lib/i18n-server";

export default async function NewVehiclePage() { const locale = await getLocale(); return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-2xl px-4 py-10"><Card className="surface-shadow border-white/70"><CardHeader><CardTitle>{locale === "th" ? "เพิ่มรถเข้า Garage" : "Add a car to your garage"}</CardTitle><CardDescription>{locale === "th" ? "เริ่มจากข้อมูลหลักและรูปที่คุณชอบที่สุด" : "Start with the essentials and your favorite photo."}</CardDescription></CardHeader><CardContent><form action={createVehicleAction} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Nickname" name="nickname" placeholder="Mochi" /><Field label="Make" name="make" placeholder="Mazda" /><Field label="Model" name="model" placeholder="MX-5 RF" /><Field label="Year" name="year" type="number" placeholder="2022" /><Field label="Trim" name="trim" placeholder="2.0 RF" /><Field label="Color" name="color" placeholder="Snowflake White" /></div><div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" rows={4} maxLength={300} /></div><div className="space-y-2"><Label htmlFor="cover">Cover photo</Label><Input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" /></div><Button>{locale === "th" ? "เพิ่มรถ" : "Add car"}</Button></form></CardContent></Card></main></>; }
function Field({ label, name, type = "text", placeholder }: { label: string; name: string; type?: string; placeholder?: string }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} placeholder={placeholder} required={["nickname","make","model","year"].includes(name)} /></div>; }
