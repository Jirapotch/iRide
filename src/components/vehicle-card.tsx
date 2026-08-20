import Image from "next/image";
import { CalendarDays, Gauge, Palette } from "lucide-react";
import { ResourceActions } from "@/components/resource-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Locale, Vehicle } from "@/lib/types";

export function VehicleCard({ vehicle, locale, canManage = false }: { vehicle: Vehicle; locale: Locale; canManage?: boolean }) {
  const details = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  return <Card id={`vehicle-${vehicle.id}`} className="surface-shadow scroll-mt-24 overflow-hidden border-white/70 py-0"><div className="relative aspect-[16/10] bg-muted">{vehicle.coverUrl ? <Image src={vehicle.coverUrl} alt={details || vehicle.name} fill sizes="(max-width: 768px) 100vw, 420px" className="object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><Gauge className="size-10" /></div>}<Badge className="absolute left-3 top-3 bg-background/90 text-foreground backdrop-blur">{vehicle.name}</Badge>{canManage && <div className="absolute right-2 top-2 rounded-full bg-background/90 backdrop-blur"><ResourceActions kind="vehicle" id={vehicle.id} editHref={`/garage/${vehicle.id}/edit`} locale={locale} /></div>}</div><CardContent className="space-y-3 p-4">{(details || vehicle.trim) && <div>{details && <h3 className="font-semibold">{details}</h3>}{vehicle.trim && <p className="text-sm text-muted-foreground">{vehicle.trim}</p>}</div>}<div className="flex flex-wrap gap-3 text-xs text-muted-foreground">{vehicle.year && <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{vehicle.year}</span>}{vehicle.color && <span className="flex items-center gap-1"><Palette className="size-3.5" />{vehicle.color}</span>}</div>{vehicle.description && <p className="text-sm leading-6 text-muted-foreground">{vehicle.description}</p>}</CardContent></Card>;
}
