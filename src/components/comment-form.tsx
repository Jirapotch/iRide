"use client";

import { useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { createCommentAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/types";

export function CommentForm({ locale, postId }: { locale: Locale; postId: string }) {
  const [body, setBody] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  return <form className="flex gap-2" aria-busy={pending} onSubmit={async (event) => { event.preventDefault(); setPending(true); setError(null); const result = await createCommentAction(postId, body); if (result.ok) setBody(""); else setError(result.message ?? "Unable to comment"); setPending(false); }}><div className="flex-1"><Input value={body} onChange={(event) => setBody(event.target.value)} placeholder={locale === "th" ? "เขียนความคิดเห็น…" : "Write a comment…"} maxLength={500} className="min-h-11" />{error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}</div><Button size="icon-lg" className="min-h-11 min-w-11" disabled={pending || !body.trim()} aria-label="Send comment">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}</Button></form>;
}
