"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function SubmitButton({ idleLabel, pendingLabel, className }: { idleLabel: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} aria-busy={pending} className={className}>
    {pending && <LoaderCircle className="size-4 animate-spin" />}
    {pending ? pendingLabel : idleLabel}
  </Button>;
}

export function IconSubmitButton({ label, children, variant = "default" }: { label: string; children: ReactNode; variant?: "default" | "outline" }) {
  const { pending } = useFormStatus();
  return <Button type="submit" size="icon-lg" variant={variant} disabled={pending} aria-busy={pending} aria-label={label} className="min-h-11 min-w-11">{pending ? <LoaderCircle className="size-4 animate-spin" /> : children}</Button>;
}
