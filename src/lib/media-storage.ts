import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type MediaBucket = "avatars" | "vehicle-media" | "post-media";
export type MediaProvider = "r2" | "supabase";

export type R2Config = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  buckets: Record<MediaBucket, string>;
};

type R2Command = PutObjectCommand | DeleteObjectCommand | GetObjectCommand;
type R2Dependencies = {
  send: (command: R2Command) => Promise<unknown>;
  sign: (command: GetObjectCommand, expiresIn: number) => Promise<string>;
};

type R2MediaOperations = Pick<ReturnType<typeof createR2MediaStorage>, "remove" | "signedUrls">;
type LegacyMediaOperations = {
  remove: (bucket: MediaBucket, key: string) => Promise<void>;
  urls: (bucket: MediaBucket, keys: string[]) => Promise<Map<string, string>>;
};

const REQUIRED_ENV = [
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_AVATARS",
  "R2_BUCKET_VEHICLE_MEDIA",
  "R2_BUCKET_POST_MEDIA",
] as const;

type RequiredEnvName = (typeof REQUIRED_ENV)[number];

const ENV_BUCKETS: Record<MediaBucket, RequiredEnvName> = {
  avatars: "R2_BUCKET_AVATARS",
  "vehicle-media": "R2_BUCKET_VEHICLE_MEDIA",
  "post-media": "R2_BUCKET_POST_MEDIA",
};

export function loadR2Config(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): R2Config {
  const missing = REQUIRED_ENV.filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`Missing R2 environment variables: ${missing.join(", ")}`);

  const value = (name: (typeof REQUIRED_ENV)[number]) => env[name]!.trim();
  return {
    endpoint: `https://${value("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    accessKeyId: value("R2_ACCESS_KEY_ID"),
    secretAccessKey: value("R2_SECRET_ACCESS_KEY"),
    buckets: {
      avatars: value(ENV_BUCKETS.avatars),
      "vehicle-media": value(ENV_BUCKETS["vehicle-media"]),
      "post-media": value(ENV_BUCKETS["post-media"]),
    },
  };
}

export function toR2Path(key: string) {
  if (!key) throw new Error("R2 object key is required");
  return `r2:${key}`;
}

export function parseMediaPath(path: string): { provider: MediaProvider; key: string } {
  if (path.startsWith("r2:")) {
    const key = path.slice(3);
    if (!key) throw new Error("R2 media path is missing an object key");
    return { provider: "r2", key };
  }
  if (!path) throw new Error("Media path is required");
  return { provider: "supabase", key: path };
}

export function mediaTtlSeconds(bucket: MediaBucket) {
  return bucket === "post-media" ? 600 : 604_800;
}

export function mediaCacheControl(bucket: MediaBucket) {
  return `private, max-age=${mediaTtlSeconds(bucket)}`;
}

export function createR2MediaStorage(config: R2Config, dependencies?: R2Dependencies) {
  const client = dependencies
    ? null
    : new S3Client({
        region: "auto",
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
  const send = dependencies?.send ?? ((command: R2Command) => client!.send(command));
  const sign = dependencies?.sign ?? ((command: GetObjectCommand, expiresIn: number) => getSignedUrl(client!, command, { expiresIn }));

  return {
    async upload(bucket: MediaBucket, key: string, body: Uint8Array, contentType: string) {
      await send(new PutObjectCommand({
        Bucket: config.buckets[bucket],
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: mediaCacheControl(bucket),
      }));
    },

    async remove(bucket: MediaBucket, key: string) {
      await send(new DeleteObjectCommand({ Bucket: config.buckets[bucket], Key: key }));
    },

    async signedUrls(bucket: MediaBucket, keys: string[]) {
      const uniqueKeys = [...new Set(keys)];
      const entries = await Promise.all(uniqueKeys.map(async (key) => {
        const command = new GetObjectCommand({ Bucket: config.buckets[bucket], Key: key });
        return [key, await sign(command, mediaTtlSeconds(bucket))] as const;
      }));
      return new Map(entries);
    },
  };
}

export function createTransitionalMediaStorage(r2: R2MediaOperations, legacy: LegacyMediaOperations) {
  return {
    async remove(bucket: MediaBucket, path: string) {
      const media = parseMediaPath(path);
      if (media.provider === "r2") await r2.remove(bucket, media.key);
      else await legacy.remove(bucket, media.key);
    },

    async urls(bucket: MediaBucket, paths: string[]) {
      const uniquePaths = [...new Set(paths)];
      const r2Keys: string[] = [];
      const legacyKeys: string[] = [];
      for (const path of uniquePaths) {
        const media = parseMediaPath(path);
        if (media.provider === "r2") r2Keys.push(media.key);
        else legacyKeys.push(media.key);
      }

      const [r2Urls, legacyUrls] = await Promise.all([
        r2.signedUrls(bucket, r2Keys),
        legacy.urls(bucket, legacyKeys),
      ]);
      const urls = new Map<string, string>();
      for (const path of uniquePaths) {
        const media = parseMediaPath(path);
        const url = media.provider === "r2" ? r2Urls.get(media.key) : legacyUrls.get(media.key);
        if (url) urls.set(path, url);
      }
      return urls;
    },
  };
}

let storage: ReturnType<typeof createR2MediaStorage> | undefined;

export function getR2MediaStorage() {
  storage ??= createR2MediaStorage(loadR2Config());
  return storage;
}
