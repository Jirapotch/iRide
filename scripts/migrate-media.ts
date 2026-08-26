import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

import { loadAllPages, migrateMediaReferences, type MediaObject, type MediaReference } from "../src/lib/media-migration";
import type { MediaBucket } from "../src/lib/media-storage";
import type { Database } from "../src/lib/supabase/database.types";

const mode = process.argv[2];
if (!new Set(["--dry-run", "--apply", "--verify"]).has(mode)) {
  throw new Error("Usage: npm run media:migrate -- --dry-run | --apply | --verify");
}

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_AVATARS",
  "R2_BUCKET_VEHICLE_MEDIA",
  "R2_BUCKET_POST_MEDIA",
] as const;
const missing = requiredEnv.filter((name) => !process.env[name]?.trim());
if (missing.length) throw new Error(`Missing migration environment variables: ${missing.join(", ")}`);
const env = (name: (typeof requiredEnv)[number]) => process.env[name]!.trim();

const buckets: Record<MediaBucket, string> = {
  avatars: env("R2_BUCKET_AVATARS"),
  "vehicle-media": env("R2_BUCKET_VEHICLE_MEDIA"),
  "post-media": env("R2_BUCKET_POST_MEDIA"),
};
const supabase = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") },
});

async function main() {
  const references = await loadReferences();
  if (mode === "--verify") {
    await verifyReferences(references);
  } else {
    const result = await migrateMediaReferences(references, {
      download: downloadLegacyObject,
      head: headR2Object,
      upload: uploadR2Object,
      updatePath: updateReferencePath,
    }, { apply: mode === "--apply" });
    console.log(JSON.stringify({ mode: mode.slice(2), total: references.length, ...result }, null, 2));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Media migration failed");
  process.exitCode = 1;
});

async function loadReferences(): Promise<MediaReference[]> {
  const [profiles, vehicles, posts] = await Promise.all([
    loadAllPages(async (from, to) => {
      const { data, error } = await supabase.from("profiles").select("id,avatar_path,cover_path").order("id").range(from, to);
      if (error) throw error;
      return data;
    }),
    loadAllPages(async (from, to) => {
      const { data, error } = await supabase.from("vehicles").select("id,cover_path").order("id").range(from, to);
      if (error) throw error;
      return data;
    }),
    loadAllPages(async (from, to) => {
      const { data, error } = await supabase.from("posts").select("id,photo_path").order("id").range(from, to);
      if (error) throw error;
      return data;
    }),
  ]);

  const result: MediaReference[] = [];
  profiles?.forEach((row) => {
    if (row.avatar_path) result.push({ table: "profiles", id: row.id, column: "avatar_path", bucket: "avatars", path: row.avatar_path });
    if (row.cover_path) result.push({ table: "profiles", id: row.id, column: "cover_path", bucket: "avatars", path: row.cover_path });
  });
  vehicles?.forEach((row) => {
    if (row.cover_path) result.push({ table: "vehicles", id: row.id, column: "cover_path", bucket: "vehicle-media", path: row.cover_path });
  });
  posts?.forEach((row) => {
    if (row.photo_path) result.push({ table: "posts", id: row.id, column: "photo_path", bucket: "post-media", path: row.photo_path });
  });
  return result;
}

async function downloadLegacyObject(bucket: MediaBucket, key: string): Promise<MediaObject> {
  const { data, error } = await supabase.storage.from(bucket).download(key);
  if (error || !data) throw error ?? new Error(`Unable to download ${bucket}/${key}`);
  const body = new Uint8Array(await data.arrayBuffer());
  return { body, size: body.byteLength, contentType: data.type || "image/webp" };
}

async function headR2Object(bucket: MediaBucket, key: string) {
  try {
    const result = await r2.send(new HeadObjectCommand({ Bucket: buckets[bucket], Key: key }));
    return { size: result.ContentLength ?? 0, contentType: result.ContentType ?? "" };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || (error as { name?: string }).name === "NotFound") return null;
    throw error;
  }
}

async function uploadR2Object(bucket: MediaBucket, key: string, object: MediaObject) {
  const maxAge = bucket === "post-media" ? 600 : 604_800;
  await r2.send(new PutObjectCommand({
    Bucket: buckets[bucket], Key: key, Body: object.body, ContentLength: object.size,
    ContentType: object.contentType, CacheControl: `private, max-age=${maxAge}`,
  }));
}

async function updateReferencePath(reference: MediaReference, path: string) {
  if (reference.table === "profiles") {
    if (reference.column === "avatar_path") {
      const { data, error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", reference.id).eq("avatar_path", reference.path).select("id");
      assertSingleUpdate(data, error, reference);
    } else if (reference.column === "cover_path") {
      const { data, error } = await supabase.from("profiles").update({ cover_path: path }).eq("id", reference.id).eq("cover_path", reference.path).select("id");
      assertSingleUpdate(data, error, reference);
    } else {
      throw new Error(`Invalid profiles media column: ${reference.column}`);
    }
  } else if (reference.table === "vehicles") {
    const { data, error } = await supabase.from("vehicles").update({ cover_path: path }).eq("id", reference.id).eq("cover_path", reference.path).select("id");
    assertSingleUpdate(data, error, reference);
  } else {
    const { data, error } = await supabase.from("posts").update({ photo_path: path }).eq("id", reference.id).eq("photo_path", reference.path).select("id");
    assertSingleUpdate(data, error, reference);
  }
}

function assertSingleUpdate(data: Array<{ id: string }> | null, error: unknown, reference: MediaReference) {
  if (error) throw error;
  if (data?.length !== 1) throw new Error(`Media path changed during migration for ${reference.table}/${reference.id}/${reference.column}`);
}

async function verifyReferences(items: MediaReference[]) {
  const legacy = items.filter((item) => !item.path.startsWith("r2:"));
  if (legacy.length) throw new Error(`${legacy.length} media references still use Supabase Storage`);

  for (const item of items) {
    const key = item.path.slice(3);
    if (!await headR2Object(item.bucket, key)) throw new Error(`Missing R2 object ${item.bucket}/${key}`);
    const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: buckets[item.bucket], Key: key }), { expiresIn: 60 });
    const response = await fetch(url);
    await response.body?.cancel();
    if (response.status !== 200) throw new Error(`Signed GET failed for ${item.bucket}/${key}: HTTP ${response.status}`);
  }
  console.log(JSON.stringify({ mode: "verify", references: items.length, legacy: 0, signedGet200: items.length }, null, 2));
}
