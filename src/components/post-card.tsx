"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Heart, LoaderCircle, MessageCircle, Sparkles } from "lucide-react";
import { toggleLikeAction } from "@/app/actions";
import { ResourceActions } from "@/components/resource-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { Locale, Post } from "@/lib/types";

function initials(name: string) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }

export function PostCard({ post, locale, canInteract, canManage = false, deleteRedirect, isDetail = false }: {
  post: Post;
  locale: Locale;
  canInteract: boolean;
  canManage?: boolean;
  deleteRedirect?: string;
  isDetail?: boolean;
}) {
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [optimistic, updateOptimistic] = useOptimistic(
    { liked: post.likedByViewer, count: post.likesCount },
    (state) => ({ liked: !state.liked, count: state.count + (state.liked ? -1 : 1) }),
  );
  const formatted = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(post.createdAt));
  const returnTo = `${pathname}#post-${post.id}`;
  const detailHref = `/post/${post.id}?returnTo=${encodeURIComponent(returnTo)}`;
  const story = <><CardContent className="space-y-3 px-4 pb-3 sm:px-5"><p className="whitespace-pre-wrap text-[15px] leading-6">{post.body}</p>{post.vehicle && <Badge variant="secondary" className="gap-1.5"><Sparkles className="size-3" />{[post.vehicle.name, post.vehicle.year, post.vehicle.brand, post.vehicle.model].filter(Boolean).join(" · ")}</Badge>}</CardContent>{post.photoUrl && <div className="relative aspect-[4/3] w-full bg-muted"><Image src={post.photoUrl} alt={`Post by ${post.author.displayName}`} fill sizes="(max-width: 768px) 100vw, 680px" className="object-cover" /></div>}</>;

  function toggleLike() {
    setError(null);
    startTransition(async () => {
      updateOptimistic(undefined);
      const result = await toggleLikeAction(post.id, optimistic.liked);
      if (!result.ok) setError(result.message ?? "Unable to like post");
    });
  }

  return <Card id={`post-${post.id}`} className="surface-shadow scroll-mt-24 overflow-hidden border-white/70 bg-card/95 py-0">
    <CardHeader className="flex flex-row items-center gap-3 px-4 pt-4 pb-3 sm:px-5">
      <Link prefetch={false} href={`/profile/${post.author.username}`}><Avatar className="size-11"><AvatarImage src={post.author.avatarUrl ?? undefined} alt={post.author.displayName} /><AvatarFallback>{initials(post.author.displayName)}</AvatarFallback></Avatar></Link>
      <div className="min-w-0 flex-1">
        <Link prefetch={false} href={`/profile/${post.author.username}`} className="truncate text-sm font-semibold hover:text-primary">{post.author.displayName}</Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>@{post.author.username}</span><span>·</span><time>{formatted}</time></div>
      </div>
      {canManage && <ResourceActions kind="post" id={post.id} editHref={`/post/${post.id}/edit`} locale={locale} redirectAfterDelete={deleteRedirect} />}
    </CardHeader>
    {isDetail ? <div>{story}</div> : <Link prefetch={false} href={detailHref} aria-label={locale === "th" ? "ดูรายละเอียดโพสต์" : "View post details"} className="block rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">{story}</Link>}
    {canInteract && <CardFooter data-testid="post-actions" className="flex-col items-stretch gap-2 px-3 py-2 sm:px-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="lg" disabled={pending} aria-busy={pending} className={optimistic.liked ? "min-h-11 gap-2 text-rose-600 hover:text-rose-600" : "min-h-11 gap-2"} onClick={toggleLike}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Heart className={optimistic.liked ? "size-4 fill-current" : "size-4"} />}{optimistic.count}</Button>
        <Button asChild variant="ghost" size="lg" className="min-h-11 gap-2"><Link prefetch={false} href={detailHref}><MessageCircle className="size-4" />{post.commentsCount}</Link></Button>
      </div>
      {error && <p role="alert" className="px-2 pb-1 text-xs text-destructive">{error}</p>}
    </CardFooter>}
  </Card>;
}
