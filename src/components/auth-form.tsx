"use client";

import { useState } from "react";
import { CircleUser, LoaderCircle } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/types";

export function AuthForm({ locale, configured, nextPath }: { locale: Locale; configured: boolean; nextPath: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const thai = locale === "th";

  async function signInWithGoogle() {
    if (!configured) return setStatus(thai ? "เพิ่ม Supabase keys เพื่อเปิดใช้งานระบบบัญชี" : "Add Supabase keys to enable authentication");
    setPending(true);
    const supabase = createClient();
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", nextPath);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.toString() } });
    if (error) setStatus(error.message);
    setPending(false);
  }

  return (
    <Card className="surface-shadow w-full max-w-md border-white/70 bg-card/95">
      <CardHeader className="items-center text-center">
        <BrandMark className="mb-4" />
        <CardTitle className="text-2xl">{thai ? "ยินดีต้อนรับสู่ iRide" : "Welcome to iRide"}</CardTitle>
        <CardDescription>{thai ? "เข้าสู่พื้นที่ที่ทุกการเดินทางมีเรื่องราว" : "Join a place where every ride has a story"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Button type="button" variant="outline" className="h-12 w-full gap-2" disabled={pending} aria-busy={pending} onClick={signInWithGoogle}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <CircleUser className="size-4" />} {pending ? (thai ? "กำลังเปิด Google…" : "Opening Google…") : (thai ? "ดำเนินการต่อด้วย Google" : "Continue with Google")}
        </Button>
        {status && <p role="status" className="rounded-xl bg-muted px-4 py-3 text-center text-sm text-muted-foreground">{status}</p>}
        <p className="text-center text-xs leading-5 text-muted-foreground">{thai ? "เมื่อดำเนินการต่อ ถือว่าคุณยอมรับข้อกำหนดและนโยบายความเป็นส่วนตัว" : "By continuing, you agree to our terms and privacy policy."}</p>
      </CardContent>
    </Card>
  );
}
