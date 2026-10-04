"use client";

import { Alert, Button, Upload } from "antd";
import { FilePdf } from "@phosphor-icons/react";
import { useState } from "react";
import type { Locale } from "@/lib/locale";
import { browserApiMutation, browserApiUpload } from "@/services/browser-api";
import { MediaUploader } from "./media-uploader";
import styles from "./owner-garage.module.css";

export function GarageDocumentUploader({
  vehicleId,
  locale,
  recordId,
  onSaved,
}: {
  readonly vehicleId: string;
  readonly locale: Locale;
  readonly recordId: string | undefined;
  readonly onSaved: () => void;
}) {
  const th = locale === "th";
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={styles.panel}>
      <MediaUploader
        locale={locale}
        purpose="vehicle_document"
        vehicleId={vehicleId}
        onReady={async (mediaId, original) => {
          await browserApiMutation(`/vehicles/${vehicleId}/documents`, "POST", {
            mediaId,
            recordId: recordId ?? null,
            filename: original.name,
          });
          onSaved();
        }}
      />
      {error ? <Alert role="alert" type="error" title={error} /> : null}
      <Upload
        accept="application/pdf"
        maxCount={1}
        disabled={pending}
        fileList={
          file ? [{ uid: "selected-pdf", name: file.name, status: "done" }] : []
        }
        beforeUpload={(next) => {
          if (
            next.type !== "application/pdf" ||
            next.size <= 0 ||
            next.size > 10 * 1024 * 1024
          ) {
            setError(
              th ? "เลือก PDF ขนาดไม่เกิน 10 MB" : "Choose a PDF under 10 MB.",
            );
            return Upload.LIST_IGNORE;
          }
          setFile(next);
          setError(null);
          return false;
        }}
        onRemove={() => {
          setFile(null);
          setError(null);
        }}
      >
        <Button icon={<FilePdf size={18} />}>
          {th ? "เลือก PDF" : "Choose PDF"}
        </Button>
      </Upload>
      {file ? (
        <Button
          type="primary"
          loading={pending}
          aria-busy={pending}
          aria-label={th ? "อัปโหลด PDF" : "Upload PDF"}
          onClick={async () => {
            if (pending) return;
            setPending(true);
            setError(null);
            const data = new FormData();
            data.set("file", file);
            if (recordId) data.set("recordId", recordId);
            try {
              await browserApiUpload(`/vehicles/${vehicleId}/documents`, data);
              setFile(null);
              onSaved();
            } catch {
              setError(
                th
                  ? "อัปโหลด PDF ไม่สำเร็จ กรุณาลองใหม่"
                  : "PDF upload failed. Please retry.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          {th ? "อัปโหลด PDF" : "Upload PDF"}
        </Button>
      ) : null}
      {pending ? (
        <p role="status" aria-live="polite">
          {th ? "กำลังอัปโหลด PDF…" : "Uploading PDF…"}
        </p>
      ) : null}
    </div>
  );
}
