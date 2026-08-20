"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { createCommentAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/types";

export function CommentForm({ locale, postId }: { locale: Locale; postId: string }) {
  const [body, setBody] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  return <form className="flex gap-2" onSubmit={async (event) => { event.preventDefault(); setPending(true); setError(null); const result = await createCommentAction(postId, body); if (result.ok) setBody(""); else setError(result.message ?? "Unable to comment"); setPending(false); }}><div className="flex-1"><Input value={body} onChange={(event) => setBody(event.target.value)} placeholder={locale === "th" ? "เขียนความคิดเห็น…" : "Write a comment…"} maxLength={500} />{error && <p className="mt-1 text-xs text-destructive">{error}</p>}</div><Button size="icon" disabled={pending || !body.trim()} aria-label="Send comment"><Send className="size-4" /></Button></form>;
}
