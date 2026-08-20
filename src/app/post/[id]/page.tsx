import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BackButton } from "@/components/back-button";
import { CommentForm } from "@/components/comment-form";
import { PostCard } from "@/components/post-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/auth-redirect";
import { getPost, getViewerContext } from "@/lib/data";
import { getLocale } from "@/lib/i18n-server";

export default async function PostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const [{ id }, query, locale, viewer] = await Promise.all([params, searchParams, getLocale(), getViewerContext()]);
  const post = await getPost(id);
  if (!post) notFound();
  const returnTo = safeNextPath(query.returnTo);
  const canInteract = Boolean(viewer?.onboardingCompleted);
  const canManage = Boolean(viewer?.username && viewer.username === post.author.username);
  return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5 sm:py-8">
    <BackButton fallbackHref={returnTo} label={locale === "th" ? "กลับ" : "Back"} />
    <PostCard post={post} locale={locale} canInteract={canInteract} canManage={canManage} deleteRedirect={returnTo} isDetail />
    <Card className="border-white/70"><CardHeader><CardTitle className="text-base">{locale === "th" ? "ความคิดเห็น" : "Comments"}</CardTitle></CardHeader><CardContent className="space-y-5">{canInteract ? <CommentForm locale={locale} postId={post.id} /> : <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">{locale === "th" ? "ตั้งค่าโปรไฟล์ให้เสร็จก่อนแสดงความคิดเห็น" : "Complete your profile before commenting."}</p>}{post.comments?.length ? <div className="space-y-3">{post.comments.map((comment) => <div key={comment.id} className="rounded-xl bg-muted/50 p-4"><p className="text-sm font-semibold">{comment.author.displayName}</p><p className="mt-1 text-sm leading-6">{comment.body}</p></div>)}</div> : <div className="rounded-xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">{locale === "th" ? "เริ่มบทสนทนาเกี่ยวกับเรื่องราวนี้" : "Start the conversation on this story."}</div>}</CardContent></Card>
  </main></>;
}
