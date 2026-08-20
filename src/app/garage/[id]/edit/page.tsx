import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BackButton } from "@/components/back-button";
import { VehicleEditForm } from "@/components/vehicle-edit-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnedVehicle } from "@/lib/data";
import { getLocale } from "@/lib/i18n-server";
import { safeNextPath } from "@/lib/auth-redirect";

export default async function EditVehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [locale, vehicle] = await Promise.all([getLocale(), getOwnedVehicle(id)]);
  if (!vehicle) notFound();
  const returnTo = query.returnTo ? safeNextPath(query.returnTo) : "/profile/me#garage";
  return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-2xl px-4 py-5 sm:py-8"><BackButton fallbackHref={returnTo} label={locale === "th" ? "กลับไปที่ Garage" : "Back to garage"} /><Card className="surface-shadow mt-2 border-white/70"><CardHeader><CardTitle>{locale === "th" ? "แก้ไข Vehicle" : "Edit vehicle"}</CardTitle><CardDescription>{locale === "th" ? "อัปเดตรายละเอียดและรูปหน้าปก" : "Update its details and cover photo."}</CardDescription></CardHeader><CardContent><VehicleEditForm vehicle={vehicle} locale={locale} returnTo={returnTo} /></CardContent></Card></main></>;
}
