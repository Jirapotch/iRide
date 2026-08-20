import Image from "next/image";
import { CalendarDays, Gauge, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Vehicle } from "@/lib/types";

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  return <Card className="surface-shadow overflow-hidden border-white/70 py-0"><div className="relative aspect-[16/10] bg-muted">{vehicle.coverUrl ? <Image src={vehicle.coverUrl} alt={`${vehicle.make} ${vehicle.model}`} fill sizes="(max-width: 768px) 100vw, 420px" className="object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><Gauge className="size-10" /></div>}<Badge className="absolute left-3 top-3 bg-background/90 text-foreground backdrop-blur">{vehicle.nickname}</Badge></div><CardContent className="space-y-3 p-4"><div><h3 className="font-semibold">{vehicle.make} {vehicle.model}</h3><p className="text-sm text-muted-foreground">{vehicle.trim}</p></div><div className="flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{vehicle.year}</span>{vehicle.color && <span className="flex items-center gap-1"><Palette className="size-3.5" />{vehicle.color}</span>}</div>{vehicle.description && <p className="text-sm leading-6 text-muted-foreground">{vehicle.description}</p>}</CardContent></Card>;
}
