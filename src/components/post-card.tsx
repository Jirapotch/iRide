"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useOptimistic, useState } from "react";
import { Heart, MessageCircle, MoreHorizontal, Sparkles } from "lucide-react";
import { toggleLikeAction } from "@/app/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { Locale, Post } from "@/lib/types";

function initials(name: string) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }

export function PostCard({ post, locale, canInteract }: { post: Post; locale: Locale; canInteract: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [optimistic, updateOptimistic] = useOptimistic(
    { liked: post.likedByViewer, count: post.likesCount },
    (state) => ({ liked: !state.liked, count: state.count + (state.liked ? -1 : 1) }),
  );
  const formatted = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(post.createdAt));

  function toggleLike() {
    setError(null);
    startTransition(async () => {
      updateOptimistic(undefined);
      const result = await toggleLikeAction(post.id, optimistic.liked);
      if (!result.ok) setError(result.message ?? "Unable to like post");
    });
  }

  return (
    <Card className="surface-shadow overflow-hidden border-white/70 bg-card/95 py-0">
      <CardHeader className="flex flex-row items-center gap-3 px-4 pt-4 pb-3 sm:px-5">
        <Link href={`/profile/${post.author.username}`}><Avatar className="size-10"><AvatarImage src={post.author.avatarUrl ?? undefined} alt={post.author.displayName} /><AvatarFallback>{initials(post.author.displayName)}</AvatarFallback></Avatar></Link>
        <div className="min-w-0 flex-1">
          <Link href={`/profile/${post.author.username}`} className="truncate text-sm font-semibold hover:text-primary">{post.author.displayName}</Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>@{post.author.username}</span><span>·</span><time>{formatted}</time></div>
        </div>
        {canInteract && <Button variant="ghost" size="icon" aria-label="Post menu"><MoreHorizontal className="size-4" /></Button>}
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-3 sm:px-5">
        <p className="whitespace-pre-wrap text-[15px] leading-6">{post.body}</p>
        {post.vehicle && <Badge variant="secondary" className="gap-1.5"><Sparkles className="size-3" />{post.vehicle.nickname} · {post.vehicle.year} {post.vehicle.make} {post.vehicle.model}</Badge>}
      </CardContent>
      {post.photoUrl && <div className="relative aspect-[4/3] w-full bg-muted"><Image src={post.photoUrl} alt={`Post by ${post.author.displayName}`} fill sizes="(max-width: 768px) 100vw, 680px" className="object-cover" /></div>}
      {canInteract && <CardFooter data-testid="post-actions" className="flex-col items-stretch gap-2 px-3 py-2 sm:px-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className={optimistic.liked ? "gap-2 text-rose-600 hover:text-rose-600" : "gap-2"} onClick={toggleLike}><Heart className={optimistic.liked ? "size-4 fill-current" : "size-4"} />{optimistic.count}</Button>
          <Button asChild variant="ghost" size="sm" className="gap-2"><Link href={`/post/${post.id}`}><MessageCircle className="size-4" />{post.commentsCount}</Link></Button>
        </div>
        {error && <p className="px-2 pb-1 text-xs text-destructive">{error}</p>}
      </CardFooter>}
    </Card>
  );
}
