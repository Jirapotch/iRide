import { Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-bold tracking-tight", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Gauge className="size-5" aria-hidden="true" />
      </span>
      {!compact && <span className="text-xl">iRide</span>}
    </span>
  );
}
