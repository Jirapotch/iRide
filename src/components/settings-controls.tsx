"use client";

import { useActionState, useEffect } from "react";
import { updateLocaleAction } from "@/app/actions";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionState, Locale } from "@/lib/types";

const initialState: ActionState = { ok: false };

export function LanguageSettings({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(updateLocaleAction, initialState);
  const { setLocale } = useLocale();
  useEffect(() => { if (state.ok && state.locale) setLocale(state.locale); }, [setLocale, state]);
  return <form action={action} className="flex flex-col gap-4 sm:flex-row sm:items-end"><div className="flex-1 space-y-2"><Label htmlFor="locale">{locale === "th" ? "ภาษา" : "Language"}</Label><Select name="locale" defaultValue={locale}><SelectTrigger id="locale" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="th">ไทย</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select></div><Button disabled={pending}>{pending ? (locale === "th" ? "กำลังบันทึก…" : "Saving…") : (locale === "th" ? "บันทึกภาษา" : "Save language")}</Button>{state.message && <p className="text-sm text-destructive">{state.message}</p>}</form>;
}
