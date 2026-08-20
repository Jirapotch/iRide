import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { CommentForm } from "@/components/comment-form";
import { PostCard } from "@/components/post-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPost } from "@/lib/data";
import { assertLocale } from "@/lib/i18n";

export default async function PostPage({ params }: { params: Promise<{ locale: string; id: string }> }) { const { locale: rawLocale, id } = await params; const locale = assertLocale(rawLocale); const post = await getPost(id); if (!post) notFound(); return <><AppHeader locale={locale} /><main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8"><PostCard post={post} locale={locale} /><Card className="border-white/70"><CardHeader><CardTitle className="text-base">{locale === "th" ? "ความคิดเห็น" : "Comments"}</CardTitle></CardHeader><CardContent className="space-y-5"><CommentForm locale={locale} postId={post.id} />{post.comments?.length ? <div className="space-y-3">{post.comments.map((comment) => <div key={comment.id} className="rounded-xl bg-muted/50 p-4"><p className="text-sm font-semibold">{comment.author.displayName}</p><p className="mt-1 text-sm leading-6">{comment.body}</p></div>)}</div> : <div className="rounded-xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">{locale === "th" ? "เริ่มบทสนทนาเกี่ยวกับเรื่องราวนี้" : "Start the conversation on this story."}</div>}</CardContent></Card></main></>; }
