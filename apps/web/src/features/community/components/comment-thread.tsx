"use client";

import { ChatCircle } from "@phosphor-icons/react";
import type { CommentDto, ContentAuthorDto } from "@iride/types";
import { useMemo, useRef, useState, type FormEvent } from "react";

import { commentAction } from "@/app/(main)/community/actions";
import { PendingLink } from "@/features/navigation/components/pending-link";
import { getComments } from "@/lib/content-api";
import type { Locale } from "@/lib/locale";

export function CommentThread({
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
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CommentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<CommentDto | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingMutations, setPendingMutations] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const submittingRef = useRef(false);
  const pendingMutationRefs = useRef(new Set<string>());

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
    if (submittingRef.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get("body") ?? "").trim();
    if (!body) return;
    submittingRef.current = true;
    setSubmitting(true);
    const tempId = `temp-${Date.now()}`;
    if (viewer) {
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
    }
    form.reset();
    setReplyTo(null);
    try {
      await commentAction(data);
      await load();
    } catch {
      setItems((current) => current.filter((item) => item.id !== tempId));
      setError(locale === "th" ? "ส่งความคิดเห็นไม่สำเร็จ" : "Comment failed");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function mutate(data: FormData) {
    const mutationKey = `${String(data.get("intent"))}:${String(data.get("id"))}`;
    if (pendingMutationRefs.current.has(mutationKey)) return;
    pendingMutationRefs.current.add(mutationKey);
    setPendingMutations(new Set(pendingMutationRefs.current));
    try {
      await commentAction(data);
      setEditing(null);
      await load();
    } catch {
      setError(locale === "th" ? "บันทึกไม่สำเร็จ" : "Update failed");
    } finally {
      pendingMutationRefs.current.delete(mutationKey);
      setPendingMutations(new Set(pendingMutationRefs.current));
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
              pendingMutations={pendingMutations}
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
              <button
                aria-busy={submitting}
                className="primary-action"
                disabled={submitting}
                type="submit"
              >
                {submitting
                  ? locale === "th"
                    ? "กำลังส่ง…"
                    : "Sending…"
                  : locale === "th"
                    ? "ส่ง"
                    : "Send"}
              </button>
            </form>
          ) : (
            <PendingLink href={`/login?next=${encodeURIComponent(returnHref)}`}>
              {locale === "th"
                ? "เข้าสู่ระบบเพื่อแสดงความคิดเห็น"
                : "Sign in to comment"}
            </PendingLink>
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
  readonly pendingMutations: ReadonlySet<string>;
  readonly onEdit: (id: string | null) => void;
  readonly onReply: (item: CommentDto) => void;
}

function CommentItem({
  comment,
  editing,
  items,
  locale,
  mutate,
  pendingMutations,
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
        pendingMutations={pendingMutations}
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
            pendingMutations={pendingMutations}
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
  pendingMutations,
  onEdit,
  onReply,
}: {
  readonly comment: CommentDto;
  readonly editing: string | null;
  readonly locale: Locale;
  readonly mutate: (data: FormData) => Promise<void>;
  readonly pendingMutations: ReadonlySet<string>;
  readonly onEdit: (id: string | null) => void;
  readonly onReply: (item: CommentDto) => void;
}) {
  const updating = pendingMutations.has(`update:${comment.id}`);
  const deleting = pendingMutations.has(`delete:${comment.id}`);
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
          <button aria-busy={updating} disabled={updating} type="submit">
            {updating
              ? locale === "th"
                ? "กำลังบันทึก…"
                : "Saving…"
              : locale === "th"
                ? "บันทึก"
                : "Save"}
          </button>
          <button
            disabled={updating}
            onClick={() => onEdit(null)}
            type="button"
          >
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
                <button aria-busy={deleting} disabled={deleting} type="submit">
                  {deleting
                    ? locale === "th"
                      ? "กำลังลบ…"
                      : "Deleting…"
                    : locale === "th"
                      ? "ลบ"
                      : "Delete"}
                </button>
              </form>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
