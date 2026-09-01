"use client";

import {
  Camera,
  ChatCircle,
  DotsThreeVertical,
  MapPin,
  NotePencil,
  Trash,
} from "@phosphor-icons/react";
import type {
  CommentDto,
  CommunityCategory,
  ContentAuthorDto,
  PhotographerSpotDto,
  PostDto,
} from "@iride/types";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { communityTalkHref, type CommunityRoomId } from "@/lib/app-navigation-domain";
import { getComments } from "@/lib/content-api";
import type { Locale } from "@/lib/locale";
import { commentAction } from "../community/actions";
import { removeContent } from "../create/actions";
import type { MarkerOption } from "./create-content-screen";
import { EditModal } from "./edit-modal";

const BackendForm = dynamic(() =>
  import("./create-content-screen").then((module) => module.BackendForm),
);
interface Props {
  readonly authenticated: boolean;
  readonly canWrite: boolean;
  readonly editId: string | undefined;
  readonly locale: Locale;
  readonly markerOptions: readonly MarkerOption[];
  readonly posts: readonly PostDto[];
  readonly room: CommunityRoomId;
  readonly spots: readonly PhotographerSpotDto[];
  readonly viewer: ContentAuthorDto | null;
  readonly category: CommunityCategory;
  readonly heading: string;
}
export function CommunityScreen({
  authenticated,
  canWrite,
  editId,
  locale,
  markerOptions,
  posts,
  room,
  spots,
  viewer,
  category,
  heading,
}: Props) {
  const talkHref = communityTalkHref(category);
  const editPost = editId
    ? (posts.find((item) => item.id === editId && item.canEdit) ?? null)
    : null;
  const editDenied = Boolean(editId && !editPost);
  return (
    <div className="community-page">
      <header className="community-heading">
        <h1>{heading}</h1>
      </header>
      {room === "talk" || room === "groups" || room === "photographers" ? (
        <TalkRoom
          authenticated={authenticated}
          canWrite={canWrite}
          category={category}
          locale={locale}
          posts={posts}
          talkHref={talkHref}
          viewer={viewer}
        />
      ) : null}
      {room === "photographers" ? (
        <PhotographerRoom locale={locale} spots={spots} />
      ) : null}
      {editPost ? (
        <EditModal
          closeUrl={`${talkHref}?post=${editPost.id}`}
          title={locale === "th" ? "แก้ไขโพสต์" : "Edit post"}
        >
          <BackendForm
            initial={editPost}
            locale={locale}
            markerOptions={markerOptions}
            type="post"
          />
        </EditModal>
      ) : null}
      {editDenied ? (
        <div className="permission-toast" role="alert">
          {locale === "th"
            ? "คุณไม่มีสิทธิ์แก้ไขรายการนี้"
            : "You do not have permission to edit this item."}
        </div>
      ) : null}
    </div>
  );
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
        <Link className="community-create-link" href={`/create?type=post&category=${category}`}>
          + {locale === "th" ? "เขียนโพสต์" : "Write a post"}
        </Link>
      ) : authenticated ? (
        <p className="access-wait-note">{locale === "th" ? "บัญชีนี้อ่านได้อย่างเดียว กรุณารอผู้ดูแลระบบปลดล็อก" : "This account is read-only until an administrator unlocks it."}</p>
      ) : null}
      {posts.length ? (
        posts.map((post) => (
          <article
            className="premium-card community-post"
            id={`post-${post.id}`}
            key={post.id}
          >
            <header>
              <Link href={`/users/${post.author.username}`}>
                {post.author.displayName}
              </Link>
              <span>@{post.author.username}</span>
              {post.canEdit ? (
                <OwnerActionMenu
                  confirmText={
                    locale === "th" ? "ลบโพสต์นี้หรือไม่?" : "Delete this post?"
                  }
                  deleteAction={removeContent}
                  editHref={`${talkHref}?post=${post.id}&modal=edit`}
                  hidden={{ domain: "posts", id: post.id, communityCategory: post.communityCategory }}
                  locale={locale}
                />
              ) : null}
            </header>
            <p>{post.body}</p>
            {post.markerTags.length ? (
              <div className="post-marker-tags">
                {post.markerTags.map((tag) =>
                  tag.available ? (
                    <Link
                      href={`/maps?marker=${tag.id}`}
                      key={`${tag.kind}:${tag.id}`}
                    >
                      <MapPin size={15} />
                      {tag.title}
                    </Link>
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
        <Empty
          text={
            locale === "th"
              ? "ยังไม่มีโพสต์ เริ่มบทสนทนาแรกได้เลย"
              : "No posts yet. Start the first conversation."
          }
        />
      )}
    </section>
  );
}

function OwnerActionMenu({
  confirmText,
  deleteAction,
  editHref,
  hidden,
  locale,
}: {
  readonly confirmText: string;
  readonly deleteAction: (data: FormData) => void | Promise<void>;
  readonly editHref: string;
  readonly hidden: Readonly<Record<string, string>>;
  readonly locale: Locale;
}) {
  const [open, setOpen] = useState(false),
    rootRef = useRef<HTMLDivElement>(null),
    buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div
      className="owner-action-menu"
      onClick={(event) => event.stopPropagation()}
      ref={rootRef}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={locale === "th" ? "จัดการรายการ" : "Manage item"}
        className="owner-menu-trigger"
        onClick={() => setOpen((value) => !value)}
        ref={buttonRef}
        type="button"
      >
        <DotsThreeVertical size={20} weight="bold" />
      </button>
      {open ? (
        <div className="owner-menu-popover" role="menu">
          <Link href={editHref} onClick={() => setOpen(false)} role="menuitem">
            <NotePencil size={16} />
            {locale === "th" ? "แก้ไข" : "Edit"}
          </Link>
          <form
            action={deleteAction}
            onSubmit={(event) => {
              if (!confirm(confirmText)) event.preventDefault();
            }}
          >
            {Object.entries(hidden).map(([name, value]) => (
              <input key={name} name={name} type="hidden" value={value} />
            ))}
            <button role="menuitem" type="submit">
              <Trash size={16} />
              {locale === "th" ? "ลบ" : "Delete"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function CommentThread({
  authenticated,
  locale,
  postId,
  returnHref,
  viewer,
}: {
  readonly authenticated: boolean;
  readonly locale: Locale;
  readonly postId: string;
  readonly returnHref: string;
  readonly viewer: ContentAuthorDto | null;
}) {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<CommentDto[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null),
    [replyTo, setReplyTo] = useState<CommentDto | null>(null),
    [editing, setEditing] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    try {
      setItems(await getComments(postId));
      setError(null);
    } catch {
      setError(
        locale === "th"
          ? "โหลดความคิดเห็นไม่สำเร็จ"
          : "Could not load comments",
      );
    } finally {
      setLoading(false);
    }
  }
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !items.length) void load();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form),
      body = String(data.get("body") ?? "").trim();
    if (!body) return;
    const tempId = `temp-${Date.now()}`;
    if (viewer)
      setItems((current) => [
        ...current,
        {
          id: tempId,
          postId,
          body,
          author: viewer,
          parentId: replyTo?.parentId ?? replyTo?.id ?? null,
          replyTo: replyTo?.author ?? null,
          deleted: false,
          canEdit: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    form.reset();
    setReplyTo(null);
    try {
      await commentAction(data);
      await load();
    } catch {
      setItems((current) => current.filter((item) => item.id !== tempId));
      setError(locale === "th" ? "ส่งความคิดเห็นไม่สำเร็จ" : "Comment failed");
    }
  }
  async function mutate(data: FormData) {
    try {
      await commentAction(data);
      setEditing(null);
      await load();
    } catch {
      setError(locale === "th" ? "บันทึกไม่สำเร็จ" : "Update failed");
    }
  }
  const roots = useMemo(() => items.filter((item) => !item.parentId), [items]);
  return (
    <div className="comment-thread">
      <button
        aria-expanded={open}
        className="comment-toggle"
        onClick={toggle}
        type="button"
      >
        <ChatCircle size={17} />
        {locale === "th" ? "ความคิดเห็น" : "Comments"}
      </button>
      {open ? (
        <div>
          {loading && !items.length ? (
            <p role="status">{locale === "th" ? "กำลังโหลด…" : "Loading…"}</p>
          ) : null}
          {error ? (
            <p className="inline-error" role="alert">
              {error}
            </p>
          ) : null}
          {roots.map((comment) => (
            <CommentItem
              comment={comment}
              editing={editing}
              items={items}
              key={comment.id}
              locale={locale}
              mutate={mutate}
              onEdit={setEditing}
              onReply={setReplyTo}
            />
          ))}
          {authenticated ? (
            <form className="comment-composer" onSubmit={submit}>
              <input name="intent" type="hidden" value="create" />
              <input name="postId" type="hidden" value={postId} />
              <input name="parentId" type="hidden" value={replyTo?.id ?? ""} />
              {replyTo ? (
                <small>
                  {locale === "th" ? "ตอบกลับ" : "Replying to"} @
                  {replyTo.author.username}{" "}
                  <button onClick={() => setReplyTo(null)} type="button">
                    ×
                  </button>
                </small>
              ) : null}
              <textarea
                maxLength={1000}
                name="body"
                placeholder={
                  locale === "th" ? "เขียนความคิดเห็น…" : "Write a comment…"
                }
                required
              />
              <button className="primary-action" type="submit">
                {locale === "th" ? "ส่ง" : "Send"}
              </button>
            </form>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(returnHref)}`}
            >
              {locale === "th"
                ? "เข้าสู่ระบบเพื่อแสดงความคิดเห็น"
                : "Sign in to comment"}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface CommentItemProps {
  readonly comment: CommentDto;
  readonly editing: string | null;
  readonly items: readonly CommentDto[];
  readonly locale: Locale;
  readonly mutate: (data: FormData) => Promise<void>;
  readonly onEdit: (id: string | null) => void;
  readonly onReply: (item: CommentDto) => void;
}
function CommentItem({
  comment,
  editing,
  items,
  locale,
  mutate,
  onEdit,
  onReply,
}: CommentItemProps) {
  const replies = items.filter((item) => item.parentId === comment.id);
  return (
    <div className="comment-item">
      <CommentBody
        comment={comment}
        editing={editing}
        locale={locale}
        mutate={mutate}
        onEdit={onEdit}
        onReply={onReply}
      />
      {replies.map((reply) => (
        <div className="comment-reply" key={reply.id}>
          <CommentBody
            comment={reply}
            editing={editing}
            locale={locale}
            mutate={mutate}
            onEdit={onEdit}
            onReply={onReply}
          />
        </div>
      ))}
    </div>
  );
}
function CommentBody({
  comment,
  editing,
  locale,
  mutate,
  onEdit,
  onReply,
}: {
  readonly comment: CommentDto;
  readonly editing: string | null;
  readonly locale: Locale;
  readonly mutate: (data: FormData) => Promise<void>;
  readonly onEdit: (id: string | null) => void;
  readonly onReply: (item: CommentDto) => void;
}) {
  return (
    <div>
      <strong>@{comment.author.username}</strong>
      {comment.replyTo ? <small> → @{comment.replyTo.username}</small> : null}
      {editing === comment.id ? (
        <form action={mutate}>
          <input name="intent" type="hidden" value="update" />
          <input name="id" type="hidden" value={comment.id} />
          <textarea
            defaultValue={comment.body ?? ""}
            maxLength={1000}
            name="body"
            required
          />
          <button type="submit">{locale === "th" ? "บันทึก" : "Save"}</button>
          <button onClick={() => onEdit(null)} type="button">
            {locale === "th" ? "ยกเลิก" : "Cancel"}
          </button>
        </form>
      ) : (
        <p>
          {comment.deleted
            ? locale === "th"
              ? "ความคิดเห็นถูกลบแล้ว"
              : "Comment deleted"
            : comment.body}
        </p>
      )}
      {!comment.deleted ? (
        <div className="comment-actions">
          <button onClick={() => onReply(comment)} type="button">
            {locale === "th" ? "ตอบกลับ" : "Reply"}
          </button>
          {comment.canEdit ? (
            <>
              <button onClick={() => onEdit(comment.id)} type="button">
                {locale === "th" ? "แก้ไข" : "Edit"}
              </button>
              <form action={mutate}>
                <input name="intent" type="hidden" value="delete" />
                <input name="id" type="hidden" value={comment.id} />
                <button type="submit">
                  {locale === "th" ? "ลบ" : "Delete"}
                </button>
              </form>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PhotographerRoom({
  locale,
  spots,
}: {
  readonly locale: Locale;
  readonly spots: readonly PhotographerSpotDto[];
}) {
  const people = Array.from(
    new Map(
      spots.map((spot) => [spot.photographer.username, spot.photographer]),
    ).values(),
  );
  return (
    <section className="room-card-grid">
      {people.length ? (
        people.map((person) => (
          <Link
            className="premium-card room-person-card"
            href={`/users/${person.username}`}
            key={person.username}
          >
            <Camera size={24} />
            <strong>{person.displayName}</strong>
            <span>@{person.username}</span>
          </Link>
        ))
      ) : (
        <Empty
          text={
            locale === "th"
              ? "ยังไม่มีช่างภาพที่ลง landmark"
              : "No photographers have published a landmark yet."
          }
        />
      )}
    </section>
  );
}
function Empty({ text }: { readonly text: string }) {
  return (
    <div className="empty-state">
      <strong>{text}</strong>
    </div>
  );
}
