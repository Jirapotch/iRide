import sharp, { type Metadata } from "sharp";

import { mediaVariantObjectKey, variantSpecs } from "@iride/storage";
import type { MediaPurpose, MediaVariantKind } from "@iride/types";

export interface MediaProcessingJob {
  readonly version: 1;
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly attempt: number;
  readonly mediaId: string;
  readonly ownerId: string;
  readonly purpose: MediaPurpose;
  readonly objectKey: string;
}

interface ReadyVariant {
  readonly kind: MediaVariantKind;
  readonly objectKey: string;
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
}

export interface MediaProcessingDependencies {
  readonly storage: {
    get: (key: string) => Promise<Buffer>;
    put: (key: string, body: Uint8Array, mimeType: string) => Promise<void>;
  };
  readonly repository: {
    markReady: (
      mediaId: string,
      value: { readonly width: number; readonly height: number; readonly variants: readonly ReadyVariant[] },
    ) => Promise<void>;
    markFailed: (mediaId: string, reason: string) => Promise<void>;
  };
}

export async function processMediaJob(
  job: MediaProcessingJob,
  dependencies: MediaProcessingDependencies,
): Promise<void> {
  try {
    const input = await dependencies.storage.get(job.objectKey);
    let metadata: Metadata;
    try {
      metadata = await sharp(input, {
        failOn: "warning",
        limitInputPixels: 40_000_000,
      }).metadata();
    } catch {
      throw new Error("MEDIA_DECODE_FAILED");
    }
    if (
      !metadata.width ||
      !metadata.height ||
      !metadata.format ||
      !["jpeg", "png", "webp"].includes(metadata.format)
    ) {
      throw new Error("MEDIA_DECODE_FAILED");
    }

    const variants: ReadyVariant[] = [];
    for (const spec of variantSpecs[job.purpose]) {
      const output = await sharp(input, {
        failOn: "warning",
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize(spec.width, spec.height, {
          fit: spec.fit,
          withoutEnlargement: spec.fit === "inside",
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      const objectKey = mediaVariantObjectKey(
        job.ownerId,
        job.purpose,
        job.mediaId,
        spec.kind,
      );
      await dependencies.storage.put(objectKey, output.data, "image/webp");
      variants.push({
        kind: spec.kind,
        objectKey,
        bytes: output.data.byteLength,
        width: output.info.width,
        height: output.info.height,
      });
    }
    await dependencies.repository.markReady(job.mediaId, {
      width: metadata.width,
      height: metadata.height,
      variants,
    });
  } catch (reason) {
    const code =
      reason instanceof Error && reason.message === "MEDIA_DECODE_FAILED"
        ? reason.message
        : "MEDIA_PROCESSING_FAILED";
    await dependencies.repository.markFailed(job.mediaId, code);
    throw new Error(code, { cause: reason });
  }
}
