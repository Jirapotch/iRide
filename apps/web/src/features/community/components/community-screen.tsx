"use client";

import { ChatCircle, MapPin } from "@phosphor-icons/react";
import type {
  CommunityCategory,
  ContentAuthorDto,
  PostDto,
} from "@iride/types";

import { removeContent } from "@/app/(main)/create/actions";
import type { CommunityRoomId } from "@/lib/app-navigation-domain";
import { communityTalkHref } from "@/lib/app-navigation-domain";
import type { Locale } from "@/lib/locale";

import { CommentThread } from "./comment-thread";
import { OwnerActionMenu } from "./owner-action-menu";
import { PendingLink } from "@/features/navigation/components/pending-link";

interface Props {
  readonly authenticated: boolean;
  readonly canWrite: boolean;
  readonly locale: Locale;
  readonly posts: readonly PostDto[];
  readonly room: CommunityRoomId;
  readonly viewer: ContentAuthorDto | null;
  readonly category: CommunityCategory;
}

export function CommunityScreen({
  authenticated,
  canWrite,
  locale,
  posts,
  room,
  viewer,
  category,
}: Props) {
  const talkHref = communityTalkHref(category);
  return room === "talk" || room === "groups" ? (
    <TalkRoom
      authenticated={authenticated}
      canWrite={canWrite}
      category={category}
      locale={locale}
      posts={posts}
      talkHref={talkHref}
      viewer={viewer}
    />
  ) : null;
}

function TalkRoom({
  authenticated,
  canWrite,
  category,
  locale,
  posts,
  talkHref,
  viewer,
}: {
  readonly authenticated: boolean;
  readonly canWrite: boolean;
  readonly category: CommunityCategory;
  readonly locale: Locale;
  readonly posts: readonly PostDto[];
  readonly talkHref: string;
  readonly viewer: ContentAuthorDto | null;
}) {
  return (
    <section className="community-feed">
      {canWrite ? (
        <PendingLink
          className="community-create-link"
          href={`/create?type=post&category=${category}`}
        >
          + {locale === "th" ? "เขียนโพสต์" : "Write a post"}
        </PendingLink>
      ) : authenticated ? (
        <p className="access-wait-note">
          {locale === "th"
            ? "บัญชีนี้อ่านได้อย่างเดียว กรุณารอผู้ดูแลระบบปลดล็อก"
            : "This account is read-only until an administrator unlocks it."}
        </p>
      ) : null}
      {posts.length ? (
        posts.map((post) => (
          <article
            className="premium-card community-post"
            id={`post-${post.id}`}
            key={post.id}
          >
            <header>
              <PendingLink href={`/users/${post.author.username}`}>
                {post.author.displayName}
              </PendingLink>
              <span>@{post.author.username}</span>
              {post.canEdit ? (
                <OwnerActionMenu
                  confirmText={
                    locale === "th" ? "ลบโพสต์นี้หรือไม่?" : "Delete this post?"
                  }
                  deleteAction={removeContent}
                  editHref={`${talkHref}?post=${post.id}&modal=edit`}
                  hidden={{
                    domain: "posts",
                    id: post.id,
                    communityCategory: post.communityCategory,
                  }}
                  locale={locale}
                />
              ) : null}
            </header>
            <p>{post.body}</p>
            {post.markerTags.length ? (
              <div className="post-marker-tags">
                {post.markerTags.map((tag) =>
                  tag.available ? (
                    <PendingLink
                      href={`/maps?marker=${tag.id}`}
                      key={`${tag.kind}:${tag.id}`}
                    >
                      <MapPin size={15} />
                      {tag.title}
                    </PendingLink>
                  ) : (
                    <span aria-disabled="true" key={`${tag.kind}:${tag.id}`}>
                      <MapPin size={15} />
                      {locale === "th" ? "ไม่พบ marker" : "Marker unavailable"}
                    </span>
                  ),
                )}
              </div>
            ) : null}
            <footer>
              <time dateTime={post.createdAt}>
                {new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(post.createdAt))}
              </time>
              <span>
                <ChatCircle size={15} />
                {post.commentCount}
              </span>
            </footer>
            <CommentThread
              authenticated={canWrite}
              locale={locale}
              postId={post.id}
              returnHref={`${talkHref}?post=${post.id}`}
              viewer={viewer}
            />
          </article>
        ))
      ) : (
        <div className="empty-state">
          <strong>
            {locale === "th"
              ? "ยังไม่มีโพสต์ เริ่มบทสนทนาแรกได้เลย"
              : "No posts yet. Start the first conversation."}
          </strong>
        </div>
      )}
    </section>
  );
}
