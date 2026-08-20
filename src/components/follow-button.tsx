"use client";

import { useState, useTransition } from "react";
import { Clock3, UserCheck, UserPlus } from "lucide-react";
import { toggleFollowAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { FollowStatus, Locale } from "@/lib/types";

export function FollowButton({ locale, profileId, initialStatus }: { locale: Locale; profileId: string; initialStatus: FollowStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const label = status === "accepted" ? (locale === "th" ? "กำลังติดตาม" : "Following") : status === "pending" ? (locale === "th" ? "ส่งคำขอแล้ว" : "Requested") : (locale === "th" ? "ติดตาม" : "Follow");
  const Icon = status === "accepted" ? UserCheck : status === "pending" ? Clock3 : UserPlus;
  return <div><Button disabled={pending} variant={status === "none" ? "default" : "outline"} className="gap-2 rounded-full" onClick={() => startTransition(async () => { setError(null); const result = await toggleFollowAction(profileId, status); if (result.ok && result.followStatus) setStatus(result.followStatus); else setError(result.message ?? "Unable to follow"); })}><Icon className="size-4" />{label}</Button>{error && <p className="mt-2 text-xs text-destructive">{error}</p>}</div>;
}
