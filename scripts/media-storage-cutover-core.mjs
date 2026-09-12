export const PROJECT_REF = "bgflnssilreepfzxoqpc";
const purposes = new Set(["avatar", "cover", "vehicle"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message) => {
  throw new Error(message);
};

export function validateOptions(options) {
  if (options.projectRef !== PROJECT_REF) fail("CUTOVER_PROJECT_MISMATCH");
  if (!options.accountId || !options.bucket)
    fail("CUTOVER_STORAGE_TARGET_REQUIRED");
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean")
    fail("CUTOVER_DRY_RUN_INVALID");
  if (
    options.dryRun === false &&
    options.confirmation !== "DELETE ALL LEGACY MEDIA"
  )
    fail("CUTOVER_CONFIRMATION_REQUIRED");
}

function keysFor(row) {
  if (
    !uuid.test(row.id) ||
    !uuid.test(row.owner_id) ||
    row.storage_provider !== "r2" ||
    !purposes.has(row.purpose)
  )
    fail("CUTOVER_ROW_INVALID");
  const prefix = `users/${row.owner_id}/${row.purpose}/${row.id}/`;
  const keys = [];
  if (row.original_object_key !== null) {
    if (row.original_object_key !== `${prefix}original`)
      fail("CUTOVER_KEY_INVALID");
    keys.push(row.original_object_key);
  }
  if (!Array.isArray(row.variants)) fail("CUTOVER_VARIANTS_INVALID");
  for (const variant of row.variants) {
    if (
      !["thumbnail", "preview"].includes(variant.kind) ||
      variant.object_key !== `${prefix}${variant.kind}.webp`
    )
      fail("CUTOVER_KEY_INVALID");
    keys.push(variant.object_key);
  }
  if (new Set(keys).size !== keys.length) fail("CUTOVER_DUPLICATE_KEY");
  return keys.sort();
}

export async function buildManifest(options, { db, storage }) {
  validateOptions(options);
  const media = [];
  for (const row of await db.list()) {
    if (row.storage_provider !== "r2" || !purposes.has(row.purpose)) continue;
    const objects = [];
    for (const key of keysFor(row)) {
      const info = await storage.head(key);
      objects.push({
        key,
        exists: info !== null,
        size: info?.size ?? null,
        etag: info?.etag ?? null,
      });
    }
    media.push({ ...row, objects });
  }
  return {
    version: 1,
    projectRef: PROJECT_REF,
    accountId: options.accountId,
    bucket: options.bucket,
    createdAt: new Date().toISOString(),
    media,
  };
}

export function validateManifest(manifest, options) {
  validateOptions(options);
  if (
    manifest.version !== 1 ||
    manifest.projectRef !== PROJECT_REF ||
    manifest.accountId !== options.accountId ||
    manifest.bucket !== options.bucket ||
    !Array.isArray(manifest.media)
  )
    fail("CUTOVER_MANIFEST_TARGET_INVALID");
  const ids = new Set();
  for (const row of manifest.media) {
    if (ids.has(row.id)) fail("CUTOVER_DUPLICATE_ROW");
    ids.add(row.id);
    const keys = keysFor(row);
    if (
      !Array.isArray(row.objects) ||
      JSON.stringify(row.objects.map((o) => o.key).sort()) !==
        JSON.stringify(keys)
    )
      fail("CUTOVER_MANIFEST_KEYS_INVALID");
    for (const object of row.objects) {
      if (
        typeof object.exists !== "boolean" ||
        (object.exists
          ? !Number.isSafeInteger(object.size) ||
            object.size < 0 ||
            typeof object.etag !== "string" ||
            !object.etag
          : object.size !== null || object.etag !== null)
      )
        fail("CUTOVER_MANIFEST_METADATA_INVALID");
    }
  }
}

export async function applyManifest(manifest, options, { db, storage }) {
  validateManifest(manifest, options);
  if (options.dryRun !== false)
    return { dryRun: true, selected: manifest.media.length };
  const result = { dryRun: false, deleted: [], skipped: [], failed: [] };
  for (const row of manifest.media) {
    try {
      let skipped = false;
      await db.withLockedRow(row.id, async (current, detachAndDelete) => {
        if (!current) {
          for (const object of row.objects) {
            if (await storage.head(object.key))
              fail("CUTOVER_MISSING_ROW_HAS_OBJECTS");
          }
          skipped = true;
          return;
        }
        if (
          current.owner_id !== row.owner_id ||
          current.purpose !== row.purpose ||
          JSON.stringify(keysFor(current)) !== JSON.stringify(keysFor(row))
        )
          fail("CUTOVER_ROW_CHANGED");
        const present = [];
        // Check every object before deleting any for this row. Missing objects are
        // expected on retries; a new/replaced object must never be deleted.
        for (const object of row.objects) {
          const info = await storage.head(object.key);
          if (!info) continue;
          if (
            !object.exists ||
            info.size !== object.size ||
            info.etag !== object.etag
          )
            fail("CUTOVER_OBJECT_CHANGED");
          present.push(object.key);
        }
        if (present.length) {
          const deleted = await storage.removeBatch(present);
          if (
            deleted.length !== present.length ||
            present.some(
              (key) => !deleted.some((item) => item.key === key && item.ok),
            )
          )
            fail("CUTOVER_OBJECT_DELETE_FAILED");
        }
        for (const object of row.objects) {
          if (await storage.head(object.key))
            fail("CUTOVER_OBJECT_STILL_PRESENT");
        }
        await detachAndDelete();
      });
      result[skipped ? "skipped" : "deleted"].push(row.id);
    } catch {
      result.failed.push(row.id);
    }
  }
  if (result.failed.length) {
    const error = new Error("CUTOVER_PARTIAL_FAILURE");
    error.result = result;
    throw error;
  }
  return result;
}
