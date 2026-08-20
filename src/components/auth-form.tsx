"use client";

import { useState } from "react";
import { CircleUser, Mail } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { emailSchema } from "@/lib/validators";
import type { Locale } from "@/lib/types";

export function AuthForm({ locale, configured }: { locale: Locale; configured: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const thai = locale === "th";

  async function signInWithGoogle() {
    if (!configured) return setStatus(thai ? "เพิ่ม Supabase keys เพื่อเปิดใช้งานระบบบัญชี" : "Add Supabase keys to enable authentication");
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/${locale}/feed` } });
    if (error) setStatus(error.message);
    setPending(false);
  }

  async function sendOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setStatus(thai ? "กรุณาใส่อีเมลที่ถูกต้อง" : "Enter a valid email address");
    if (!configured) return setStatus(thai ? "เพิ่ม Supabase keys เพื่อเปิดใช้งานระบบบัญชี" : "Add Supabase keys to enable authentication");
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email: parsed.data, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/${locale}/feed` } });
    setStatus(error ? error.message : thai ? "ส่งลิงก์เข้าสู่ระบบไปที่อีเมลแล้ว" : "Check your inbox for your sign-in link");
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
        <Button type="button" variant="outline" className="h-11 w-full gap-2" disabled={pending} onClick={signInWithGoogle}>
          <CircleUser className="size-4" /> {thai ? "ดำเนินการต่อด้วย Google" : "Continue with Google"}
        </Button>
        <div className="flex items-center gap-3"><Separator className="flex-1" /><span className="text-xs text-muted-foreground">{thai ? "หรือ" : "OR"}</span><Separator className="flex-1" /></div>
        <form onSubmit={sendOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative"><Mail className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 pl-10" placeholder="you@example.com" /></div>
          </div>
          <Button className="h-11 w-full" disabled={pending}>{thai ? "ส่งลิงก์เข้าสู่ระบบ" : "Email me a sign-in link"}</Button>
        </form>
        {status && <p role="status" className="rounded-xl bg-muted px-4 py-3 text-center text-sm text-muted-foreground">{status}</p>}
        <p className="text-center text-xs leading-5 text-muted-foreground">{thai ? "เมื่อดำเนินการต่อ ถือว่าคุณยอมรับข้อกำหนดและนโยบายความเป็นส่วนตัว" : "By continuing, you agree to our terms and privacy policy."}</p>
      </CardContent>
    </Card>
  );
}
