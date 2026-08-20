"use client";

import { startTransition, useOptimistic, useState } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import { toggleFollowAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/types";

export function FollowButton({ locale, profileId }: { locale: Locale; profileId: string }) {
  const [following, setFollowing] = useOptimistic(false, (state) => !state);
  const [error, setError] = useState<string | null>(null);
  return <div><Button variant={following ? "outline" : "default"} className="gap-2 rounded-full" onClick={() => startTransition(async () => { setFollowing(undefined); const result = await toggleFollowAction(locale, profileId, following); if (!result.ok) setError(result.message ?? "Unable to follow"); })}>{following ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}{following ? (locale === "th" ? "กำลังติดตาม" : "Following") : (locale === "th" ? "ติดตาม" : "Follow")}</Button>{error && <p className="mt-2 text-xs text-destructive">{error}</p>}</div>;
}
