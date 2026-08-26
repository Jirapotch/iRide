import type { MediaBucket } from "@/lib/media-storage";

export type MediaReference = {
  table: "profiles" | "vehicles" | "posts";
  id: string;
  column: "avatar_path" | "cover_path" | "photo_path";
  bucket: MediaBucket;
  path: string;
};

export type MediaObject = {
  body: Uint8Array;
  size: number;
  contentType: string;
};

export type MediaObjectMetadata = Pick<MediaObject, "size" | "contentType">;

type MigrationDependencies = {
  download: (bucket: MediaBucket, key: string) => Promise<MediaObject>;
  head: (bucket: MediaBucket, key: string) => Promise<MediaObjectMetadata | null>;
  upload: (bucket: MediaBucket, key: string, object: MediaObject) => Promise<void>;
  updatePath: (reference: MediaReference, path: string) => Promise<void>;
};

type MigrationResult = {
  legacy: number;
  alreadyMigrated: number;
  copied: number;
  reused: number;
};

function metadataMatches(actual: MediaObjectMetadata, expected: MediaObjectMetadata) {
  return actual.size === expected.size && actual.contentType === expected.contentType;
}

export async function loadAllPages<T>(fetchPage: (from: number, to: number) => Promise<T[]>, pageSize = 1_000) {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function migrateMediaReferences(
  references: MediaReference[],
  dependencies: MigrationDependencies,
  options: { apply: boolean },
): Promise<MigrationResult> {
  const result: MigrationResult = { legacy: 0, alreadyMigrated: 0, copied: 0, reused: 0 };

  for (const reference of references) {
    if (reference.path.startsWith("r2:")) {
      result.alreadyMigrated += 1;
      continue;
    }
    result.legacy += 1;
    if (!options.apply) continue;

    const source = await dependencies.download(reference.bucket, reference.path);
    const existing = await dependencies.head(reference.bucket, reference.path);
    if (existing) {
      if (!metadataMatches(existing, source)) {
        throw new Error(`R2 object mismatch for ${reference.bucket}/${reference.path}`);
      }
      result.reused += 1;
    } else {
      await dependencies.upload(reference.bucket, reference.path, source);
      const uploaded = await dependencies.head(reference.bucket, reference.path);
      if (!uploaded || !metadataMatches(uploaded, source)) {
        throw new Error(`R2 verification failed for ${reference.bucket}/${reference.path}`);
      }
      result.copied += 1;
    }

    await dependencies.updatePath(reference, `r2:${reference.path}`);
  }

  return result;
}
