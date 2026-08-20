"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, LoaderCircle, UserRoundX } from "lucide-react";
import { respondToFollowRequestAction, updateLocaleAction, updatePrivacyAction } from "@/app/actions";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionState, Locale } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function LanguageSettings({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(updateLocaleAction, initialState);
  const { setLocale } = useLocale();
  useEffect(() => { if (state.ok && state.locale) setLocale(state.locale); }, [setLocale, state]);
  return <form action={action} className="flex flex-col gap-4 sm:flex-row sm:items-end"><div className="flex-1 space-y-2"><Label htmlFor="locale">{locale === "th" ? "ภาษา" : "Language"}</Label><Select name="locale" defaultValue={locale}><SelectTrigger id="locale" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="th">ไทย</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select></div><Button disabled={pending}>{pending ? (locale === "th" ? "กำลังบันทึก…" : "Saving…") : (locale === "th" ? "บันทึกภาษา" : "Save language")}</Button>{state.message && <p role="alert" className="text-sm text-destructive">{state.message}</p>}</form>;
}

export function PrivacySettings({ locale, isPrivate }: { locale: Locale; isPrivate: boolean }) {
  const [state, action, pending] = useActionState(updatePrivacyAction, initialState);
  const thai = locale === "th";
  return <form action={action} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div><Label htmlFor="isPrivate" className="text-base">{thai ? "บัญชีส่วนตัว" : "Private account"}</Label><p className="mt-1 text-sm text-muted-foreground">{thai ? "ข้อมูลโปรไฟล์พื้นฐานยังคงมองเห็นได้" : "Basic profile information remains visible."}</p></div>
    <div className="flex flex-wrap items-center justify-end gap-3"><Input id="isPrivate" name="isPrivate" type="checkbox" defaultChecked={isPrivate} className="size-6" /><Button disabled={pending}>{pending ? (thai ? "กำลังบันทึก…" : "Saving…") : (thai ? "บันทึก" : "Save")}</Button>{state.message && <p role="alert" className="w-full text-right text-sm text-destructive">{state.message}</p>}</div>
  </form>;
}

export function FollowRequestActions({ followerId, locale }: { followerId: string; locale: Locale }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const thai = locale === "th";
  function respond(decision: "accept" | "reject") {
    setError(null);
    startTransition(async () => {
      const result = await respondToFollowRequestAction(followerId, decision);
      if (!result.ok) setError(result.message ?? (thai ? "ตอบคำขอไม่สำเร็จ" : "Unable to respond"));
    });
  }
  return <div className="flex flex-wrap justify-end gap-2">
    <Button type="button" size="icon-lg" disabled={pending} onClick={() => respond("accept")} aria-label={thai ? "อนุมัติคำขอ" : "Accept request"}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}</Button>
    <Button type="button" size="icon-lg" variant="outline" disabled={pending} onClick={() => respond("reject")} aria-label={thai ? "ปฏิเสธคำขอ" : "Reject request"}><UserRoundX className="size-4" /></Button>
    {error && <p role="alert" className="w-full text-right text-xs text-destructive">{error}</p>}
  </div>;
}
