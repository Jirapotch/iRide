import type {
  MediaPurpose,
  MediaUploadAuthorizationDto,
  MediaUploadRequest,
} from "@iride/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function uploadAuthorizedMedia(
  authorization: MediaUploadAuthorizationDto,
  blob: Blob,
  client: Pick<SupabaseClient, "storage">,
): Promise<void> {
  const expiry = Date.parse(authorization.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now())
    throw new Error("MEDIA_UPLOAD_EXPIRED");
  const { error } = await client.storage
    .from(authorization.bucketId)
    .uploadToSignedUrl(
      authorization.objectPath,
      authorization.uploadToken,
      blob,
      { contentType: blob.type, upsert: false },
    );
  if (error) throw new Error("MEDIA_UPLOAD_FAILED", { cause: error });
}

export async function prepareMediaImage(
  file: File,
  options: {
    purpose: MediaPurpose;
    cropRatio?: number | undefined;
    x?: number;
    y?: number;
  },
): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size <= 0 ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("MEDIA_UPLOAD_INVALID");
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 40_000_000
    )
      throw new Error("MEDIA_UPLOAD_INVALID");
    const ratio =
      options.purpose === "avatar"
        ? 1
        : options.purpose === "cover"
          ? (options.cropRatio ?? 3)
          : undefined;
    if (ratio !== undefined && (!Number.isFinite(ratio) || ratio <= 0))
      throw new Error("MEDIA_UPLOAD_INVALID");
    let width = bitmap.width,
      height = bitmap.height;
    if (ratio) {
      if (width / height > ratio) width = height * ratio;
      else height = width / ratio;
    }
    const scale = Math.min(
      1,
      options.purpose === "vehicle"
        ? 2048 / Math.max(width, height)
        : (options.purpose === "avatar" ? 1024 : 1800) / width,
    );
    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("MEDIA_PREPARATION_FAILED");
    const position = (value = 50) => Math.min(100, Math.max(0, value)) / 100;
    context.drawImage(
      bitmap,
      (bitmap.width - width) * position(options.x),
      (bitmap.height - height) * position(options.y),
      width,
      height,
      0,
      0,
      outputWidth,
      outputHeight,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (output) =>
          output
            ? resolve(output)
            : reject(new Error("MEDIA_PREPARATION_FAILED")),
        "image/webp",
        0.82,
      ),
    );
    if (blob.type !== "image/webp") throw new Error("MEDIA_WEBP_UNSUPPORTED");
    if (blob.size <= 0 || blob.size > 10 * 1024 * 1024)
      throw new Error("MEDIA_UPLOAD_INVALID");
    return blob;
  } finally {
    bitmap.close();
  }
}

export type MediaUploadPhase = "preparing" | "uploading" | "processing";
interface UploadAttemptDependencies {
  authorize: (
    input: MediaUploadRequest,
  ) => Promise<MediaUploadAuthorizationDto>;
  reauthorize: (mediaId: string) => Promise<MediaUploadAuthorizationDto>;
  upload: (
    authorization: MediaUploadAuthorizationDto,
    blob: Blob,
  ) => Promise<void>;
  complete: (mediaId: string) => Promise<{ mediaId: string; status: string }>;
  wait: () => Promise<void>;
}

/** Retains the processed bytes and authorization across explicit user retries. */
export function createMediaUploadAttempt(
  blob: Blob,
  purpose: MediaPurpose,
  dependencies: UploadAttemptDependencies,
) {
  const uploadId = crypto.randomUUID();
  let authorization: MediaUploadAuthorizationDto | undefined;
  let running = false;
  return {
    async run(onPhase: (phase: MediaUploadPhase) => void): Promise<string> {
      if (running) throw new Error("MEDIA_UPLOAD_PENDING");
      running = true;
      try {
        let state: { mediaId: string; status: string } | undefined;
        if (authorization) {
          onPhase("processing");
          // A failed network response does not tell us whether storage accepted the bytes.
          try {
            state = await dependencies.complete(authorization.mediaId);
          } catch {
            /* Reauthorization checks authoritative ownership/status again. */
          }
          if (!state || state.status === "uploading") {
            authorization = await dependencies.reauthorize(
              authorization.mediaId,
            );
          }
        } else {
          authorization = await dependencies.authorize({
            uploadId,
            filename: `${purpose}.webp`,
            mimeType: "image/webp",
            bytes: blob.size,
            purpose,
          });
        }
        if (!state || state.status === "uploading") {
          onPhase("uploading");
          await dependencies.upload(authorization, blob);
          onPhase("processing");
          state = await dependencies.complete(authorization.mediaId);
        }
        for (let count = 0; state.status !== "ready" && count < 30; count++) {
          if (state.status === "failed" || state.status === "deleted")
            throw new Error("MEDIA_PROCESSING_FAILED");
          await dependencies.wait();
          state = await dependencies.complete(authorization.mediaId);
        }
        if (state.status !== "ready")
          throw new Error("MEDIA_PROCESSING_TIMEOUT");
        return authorization.mediaId;
      } finally {
        running = false;
      }
    },
  };
}
