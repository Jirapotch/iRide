"use client";
import { UploadSimple } from "@phosphor-icons/react";
import type { MediaPurpose } from "@iride/types";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  authorizeMediaAction,
  completeMediaAction,
  reauthorizeMediaAction,
} from "@/app/media-actions";
import type { Locale } from "@/lib/locale";
import {
  createMediaUploadAttempt,
  prepareMediaImage,
  uploadAuthorizedMedia,
  type MediaUploadPhase,
} from "@/lib/media-upload";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function MediaUploader({
  cropRatio,
  locale,
  onReady,
  purpose,
}: {
  readonly cropRatio?: number;
  readonly locale: Locale;
  readonly onReady: (id: string) => Promise<void> | void;
  readonly purpose: MediaPurpose;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<string | null>(null),
    [x, setX] = useState(50),
    [y, setY] = useState(50),
    [status, setStatus] = useState<string | null>(null),
    [phase, setPhase] = useState<MediaUploadPhase | null>(null),
    [cropLocked, setCropLocked] = useState(false);
  const attempt = useRef<ReturnType<typeof createMediaUploadAttempt> | null>(
    null,
  );
  const operation = useRef<AbortController | null>(null);
  const pending = phase !== null;
  const ratio =
    purpose === "avatar"
      ? 1
      : purpose === "cover"
        ? (cropRatio ?? 3)
        : undefined;
  const phaseLabel =
    phase === "preparing"
      ? locale === "th"
        ? "กำลังเตรียมรูป…"
        : "Preparing image…"
      : phase === "uploading"
        ? locale === "th"
          ? "กำลังอัปโหลด…"
          : "Uploading…"
        : locale === "th"
          ? "กำลังประมวลผล…"
          : "Processing…";
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function choose(next: File | null) {
    if (operation.current) return;
    if (!next) {
      setFile(null);
      setPreview(null);
      attempt.current = null;
      setCropLocked(false);
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(next.type) ||
      next.size === 0 ||
      next.size > 10 * 1024 * 1024
    ) {
      setStatus(
        locale === "th"
          ? "รองรับ JPG, PNG, WebP ไม่เกิน 10 MB"
          : "Use JPG, PNG or WebP under 10 MB",
      );
      return;
    }
    setFile(next);
    attempt.current = null;
    setCropLocked(false);
    setX(50);
    setY(50);
    setPreview(URL.createObjectURL(next));
    setStatus(null);
  }
  async function upload() {
    if (!file || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    const { signal } = controller;
    setStatus(null);
    setPhase(attempt.current ? "processing" : "preparing");
    try {
      if (!attempt.current) {
        const blob = await prepareMediaImage(file, {
          purpose,
          cropRatio: ratio,
          x,
          y,
        });
        signal.throwIfAborted();
        const client = createBrowserSupabaseClient();
        attempt.current = createMediaUploadAttempt(blob, purpose, {
          authorize: authorizeMediaAction,
          reauthorize: reauthorizeMediaAction,
          complete: completeMediaAction,
          upload: (auth, image) => uploadAuthorizedMedia(auth, image, client),
          wait: () =>
            new Promise<void>((resolve, reject) => {
              const activeSignal = operation.current?.signal;
              if (!activeSignal) {
                reject(new Error("MEDIA_UPLOAD_CANCELLED"));
                return;
              }
              activeSignal.throwIfAborted();
              const abort = () => {
                clearTimeout(timer);
                reject(activeSignal.reason);
              };
              const timer = setTimeout(() => {
                activeSignal.removeEventListener("abort", abort);
                resolve();
              }, 2000);
              activeSignal.addEventListener("abort", abort, { once: true });
            }),
        });
        setCropLocked(true);
      }
      const mediaId = await attempt.current.run((nextPhase) => {
        signal.throwIfAborted();
        setPhase(nextPhase);
      });
      signal.throwIfAborted();
      await onReady(mediaId);
      signal.throwIfAborted();
      attempt.current = null;
      setCropLocked(false);
      setStatus(locale === "th" ? "อัปโหลดสำเร็จ" : "Upload complete");
      setFile(null);
      setPreview(null);
    } catch {
      if (signal.aborted) return;
      setStatus(
        locale === "th"
          ? "อัปโหลดไม่สำเร็จ กรุณาลองใหม่"
          : "Upload failed. Try again.",
      );
    } finally {
      operation.current = null;
      if (!signal.aborted) setPhase(null);
    }
  }
  return (
    <div aria-busy={pending} className="media-uploader">
      {preview ? (
        <div className="crop-preview" style={{ aspectRatio: ratio ?? 16 / 9 }}>
          <Image
            alt={
              locale === "th" ? "ตัวอย่างรูปที่เลือก" : "Selected image preview"
            }
            fill
            src={preview}
            style={{
              objectFit: ratio ? "cover" : "contain",
              objectPosition: `${x}% ${y}%`,
            }}
            unoptimized
          />
        </div>
      ) : null}
      {preview && ratio ? (
        <div className="crop-controls">
          <label>
            {locale === "th" ? "ตำแหน่งแนวนอน" : "Horizontal position"}
            <input
              max="100"
              disabled={pending || cropLocked}
              min="0"
              onChange={(event) => setX(Number(event.target.value))}
              type="range"
              value={x}
            />
          </label>
          <label>
            {locale === "th" ? "ตำแหน่งแนวตั้ง" : "Vertical position"}
            <input
              max="100"
              disabled={pending || cropLocked}
              min="0"
              onChange={(event) => setY(Number(event.target.value))}
              type="range"
              value={y}
            />
          </label>
        </div>
      ) : null}
      <div className="media-upload-actions">
        <label className="image-picker-button">
          <UploadSimple size={18} />
          <span>{locale === "th" ? "เลือกรูป" : "Choose image"}</span>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={pending}
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        {file ? (
          <button
            className="primary-action"
            disabled={pending}
            onClick={upload}
            type="button"
          >
            {pending
              ? phaseLabel
              : locale === "th"
                ? "อัปโหลดรูปนี้"
                : "Upload this image"}
          </button>
        ) : null}
      </div>
      <p aria-live="polite" role="status">
        {pending ? phaseLabel : status}
      </p>
    </div>
  );
}
