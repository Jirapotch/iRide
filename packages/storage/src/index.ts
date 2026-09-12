import type { MediaPurpose, MediaVariantKind } from "@iride/types";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

export type StorageProvider = "r2" | "supabase";
export interface StorageBoundary {
  readonly provider: StorageProvider;
  readonly originals: "private";
}
export interface SignedUploadAuthorization {
  readonly bucketId: string;
  readonly objectPath: string;
  readonly uploadToken: string;
  readonly expiresAt: string;
}
export interface VariantSpec {
  readonly kind: MediaVariantKind;
  readonly width: number;
  readonly height: number;
  readonly fit: "cover" | "inside";
}

export const variantSpecs: Readonly<
  Record<MediaPurpose, readonly VariantSpec[]>
> = {
  avatar: [
    { kind: "thumbnail", width: 256, height: 256, fit: "cover" },
    { kind: "preview", width: 512, height: 512, fit: "cover" },
  ],
  cover: [
    { kind: "thumbnail", width: 600, height: 200, fit: "cover" },
    { kind: "preview", width: 1600, height: 534, fit: "cover" },
  ],
  vehicle: [
    { kind: "thumbnail", width: 480, height: 320, fit: "cover" },
    { kind: "preview", width: 1280, height: 960, fit: "inside" },
  ],
};

export function mediaObjectKey(
  userId: string,
  purpose: MediaPurpose,
  _filename: string,
  mediaId: string,
) {
  return `users/${userId}/${purpose}/${mediaId}/original`;
}

export function mediaVariantObjectKey(
  userId: string,
  purpose: MediaPurpose,
  mediaId: string,
  kind: MediaVariantKind,
) {
  return `users/${userId}/${purpose}/${mediaId}/${kind}.webp`;
}

export interface R2Config {
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
}
export interface StoredObjectInfo {
  readonly bytes: number;
  readonly contentType: string | null;
}

export function createR2Storage(config: R2Config) {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return {
    async signUpload(
      key: string,
      mimeType: string,
      bytes: number,
      expiresIn = 300,
    ) {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: mimeType,
        ContentLength: bytes,
      });
      return getSignedUrl(client, command, { expiresIn });
    },
    async signDownload(key: string, expiresIn = 120) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        { expiresIn },
      );
    },
    async head(key: string): Promise<StoredObjectInfo> {
      const value = await client.send(
        new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
      );
      return {
        bytes: value.ContentLength ?? 0,
        contentType: value.ContentType ?? null,
      };
    },
    async get(key: string) {
      const value = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      );
      if (!value.Body) throw new Error("R2_OBJECT_BODY_MISSING");
      return Buffer.from(await value.Body.transformToByteArray());
    },
    async put(key: string, body: Uint8Array, mimeType: string) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: mimeType,
          ContentLength: body.byteLength,
        }),
      );
    },
    async remove(key: string) {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
      );
    },
  };
}
export type R2Storage = ReturnType<typeof createR2Storage>;

export function createSupabaseStorage(config: {
  readonly url: string;
  readonly serviceRoleKey: string;
}) {
  const bucketId = "media";
  const bucket = createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }).storage.from(bucketId);
  return {
    async signUpload(
      key: string,
      mimeType: string,
      bytes: number,
    ): Promise<SignedUploadAuthorization> {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(mimeType) ||
        !Number.isInteger(bytes) ||
        bytes <= 0 ||
        bytes > 10 * 1024 * 1024
      )
        throw new Error("STORAGE_UPLOAD_INVALID");
      const { data, error } = await bucket.createSignedUploadUrl(key, {
        upsert: false,
      });
      if (error) throw error;
      // Read expiry from the server-issued token; Supabase controls its lifetime.
      let expiresAt: string;
      try {
        const payload = JSON.parse(
          Buffer.from(data.token.split(".")[1] ?? "", "base64url").toString(
            "utf8",
          ),
        ) as { exp?: unknown };
        if (
          typeof payload.exp !== "number" ||
          !Number.isFinite(payload.exp) ||
          payload.exp * 1000 <= Date.now()
        )
          throw new Error();
        expiresAt = new Date(payload.exp * 1000).toISOString();
      } catch {
        throw new Error("STORAGE_UPLOAD_TOKEN_INVALID");
      }
      return {
        bucketId,
        objectPath: data.path,
        uploadToken: data.token,
        expiresAt,
      };
    },
    async signDownload(key: string, expiresIn = 120) {
      if (!Number.isInteger(expiresIn) || expiresIn <= 0)
        throw new Error("STORAGE_DOWNLOAD_EXPIRY_INVALID");
      const { data, error } = await bucket.createSignedUrl(key, expiresIn);
      if (error) throw error;
      return data.signedUrl;
    },
    async head(key: string): Promise<StoredObjectInfo> {
      const { data, error } = await bucket.info(key);
      if (error) throw error;
      if (
        typeof data.size !== "number" ||
        !Number.isFinite(data.size) ||
        data.size < 0
      )
        throw new Error("STORAGE_OBJECT_METADATA_INVALID");
      return { bytes: data.size, contentType: data.contentType ?? null };
    },
    async get(key: string) {
      const { data, error } = await bucket.download(key);
      if (error) throw error;
      return Buffer.from(await data.arrayBuffer());
    },
    async put(key: string, body: Uint8Array, mimeType: string) {
      const { error } = await bucket.upload(key, body, {
        contentType: mimeType,
        upsert: true,
      });
      if (error) throw error;
    },
    async remove(key: string) {
      const { error } = await bucket.remove([key]);
      if (error) throw error;
    },
  };
}

export interface ObjectStorage {
  head: (key: string) => Promise<StoredObjectInfo>;
  get: (key: string) => Promise<Buffer>;
  put: (key: string, body: Uint8Array, mimeType: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
  signDownload: (key: string, expiresIn?: number) => Promise<string>;
}

export function routeMediaStorage(providers: {
  r2: ObjectStorage;
  supabase: ObjectStorage & {
    signUpload: (
      key: string,
      mimeType: string,
      bytes: number,
    ) => Promise<SignedUploadAuthorization>;
  };
}) {
  function select(provider: StorageProvider) {
    if (provider !== "r2" && provider !== "supabase")
      throw new Error("STORAGE_PROVIDER_INVALID");
    return providers[provider];
  }
  return {
    signUpload: (key: string, mimeType: string, bytes: number) =>
      providers.supabase.signUpload(key, mimeType, bytes),
    head: (key: string, provider: StorageProvider = "r2") =>
      select(provider).head(key),
    get: (key: string, provider: StorageProvider = "r2") =>
      select(provider).get(key),
    put: (
      key: string,
      body: Uint8Array,
      mimeType: string,
      provider: StorageProvider = "r2",
    ) => select(provider).put(key, body, mimeType),
    remove: (key: string, provider: StorageProvider = "r2") =>
      select(provider).remove(key),
    signDownload: (
      key: string,
      expiresIn = 120,
      provider: StorageProvider = "r2",
    ) => select(provider).signDownload(key, expiresIn),
  };
}

export function createMediaStorage(config: {
  r2: R2Config;
  supabase: { url: string; serviceRoleKey: string };
}) {
  return routeMediaStorage({
    r2: createR2Storage(config.r2),
    supabase: createSupabaseStorage(config.supabase),
  });
}
