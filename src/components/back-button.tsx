"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BackButton({ fallbackHref = "/", label }: { fallbackHref?: string; label: string }) {
  const router = useRouter();
  return <Button type="button" variant="ghost" className="min-h-11 gap-2 px-2" onClick={() => {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    if (referrer?.origin === window.location.origin && window.history.length > 1) router.back();
    else router.replace(fallbackHref);
  }}><ArrowLeft className="size-4" />{label}</Button>;
}
