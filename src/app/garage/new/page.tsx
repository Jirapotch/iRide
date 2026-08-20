import { AppHeader } from "@/components/app-header";
import { BackButton } from "@/components/back-button";
import { NewVehicleForm } from "@/components/new-vehicle-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocale } from "@/lib/i18n-server";

export default async function NewVehiclePage() {
  const locale = await getLocale();
  return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-2xl px-4 py-5 sm:py-8"><BackButton fallbackHref="/profile/me#garage" label={locale === "th" ? "กลับไปที่ Garage" : "Back to garage"} /><Card className="surface-shadow mt-2 border-white/70"><CardHeader><CardTitle>{locale === "th" ? "เพิ่ม Vehicle เข้า Garage" : "Add a vehicle to your garage"}</CardTitle><CardDescription>{locale === "th" ? "กรอกชื่อก่อน ส่วนข้อมูลอื่นเพิ่มภายหลังได้" : "Start with a name. Everything else is optional."}</CardDescription></CardHeader><CardContent><NewVehicleForm locale={locale} /></CardContent></Card></main></>;
}
