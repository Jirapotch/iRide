/* global process, structuredClone */
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { buildManifest, applyManifest } from "./media-storage-cutover-core.mjs";
import {
  createDatabaseAdapter,
  createStorageAdapter,
} from "./media-storage-cutover-adapters.mjs";

const owner = "10000000-0000-4000-8000-000000000000";
const row = (id, provider = "r2") => ({
  id,
  owner_id: owner,
  purpose: "avatar",
  storage_provider: provider,
  original_object_key: `users/${owner}/avatar/${id}/original`,
  bytes: 100,
  variants: [
    {
      kind: "preview",
      object_key: `users/${owner}/avatar/${id}/preview.webp`,
      bytes: 50,
      width: 512,
      height: 512,
    },
  ],
  profiles: [{ id: owner, avatar: true, cover: false }],
  vehicles: [],
});
const one = "20000000-0000-4000-8000-000000000001";
const two = "20000000-0000-4000-8000-000000000002";
const options = {
  projectRef: "bgflnssilreepfzxoqpc",
  accountId: "account",
  bucket: "iride",
};
function fixture(rows = [row(one), row(two, "supabase")]) {
  const records = new Map(rows.map((r) => [r.id, structuredClone(r)]));
  const objects = new Map(
    rows
      .flatMap((r) => [
        r.original_object_key,
        ...r.variants.map((v) => v.object_key),
      ])
      .map((key) => [key, { size: 100, etag: '"abc"' }]),
  );
  const events = [];
  let failKey;
  return {
    records,
    objects,
    events,
    fail: (key) => {
      failKey = key;
    },
    db: {
      list: async () => [...records.values()],
      withLockedRow: async (id, callback) => {
        const value = records.get(id);
        await callback(value, async () => {
          assert(!objects.has(value.original_object_key));
          assert(value.variants.every((v) => !objects.has(v.object_key)));
          events.push(`detach:${id}`, `delete:${id}`);
          records.delete(id);
        });
      },
    },
    storage: {
      head: async (key) => objects.get(key) ?? null,
      removeBatch: async (keys) => {
        events.push(...keys.map((key) => `object:${key}`));
        return keys.map((key) => {
          if (key === failKey) return { key, ok: false };
          objects.delete(key);
          return { key, ok: true };
        });
      },
    },
  };
}
test("manifest filters Supabase and captures associations, all keys and HEAD metadata", async () => {
  const f = fixture();
  const manifest = await buildManifest(options, f);
  assert.equal(manifest.media.length, 1);
  assert.equal(manifest.media[0].id, one);
  assert.deepEqual(manifest.media[0].profiles, [
    { id: owner, avatar: true, cover: false },
  ]);
  assert.deepEqual(
    manifest.media[0].objects.map((o) => [o.size, o.etag]),
    [
      [100, '"abc"'],
      [100, '"abc"'],
    ],
  );
  assert.equal(f.events.length, 0);
});
test("dry-run defaults to no mutations", async () => {
  const f = fixture();
  const manifest = await buildManifest(options, f);
  const result = await applyManifest(manifest, options, f);
  assert.equal(result.dryRun, true);
  assert.equal(f.events.length, 0);
  assert.equal(f.records.size, 2);
});
test("confirmation and project mismatch fail before mutation", async () => {
  const f = fixture();
  const manifest = await buildManifest(options, f);
  for (const override of [
    { confirmation: "yes" },
    { projectRef: "other" },
    { dryRun: "false" },
  ]) {
    await assert.rejects(
      applyManifest(
        manifest,
        {
          ...options,
          dryRun: false,
          confirmation: "DELETE ALL LEGACY MEDIA",
          ...override,
        },
        f,
      ),
    );
  }
  assert.equal(f.events.length, 0);
});
test("partial storage failure retains failed DB row and same manifest can resume", async () => {
  const f = fixture([row(one), row(two)]);
  const manifest = await buildManifest(options, f);
  f.fail(row(two).variants[0].object_key);
  const apply = {
    ...options,
    dryRun: false,
    confirmation: "DELETE ALL LEGACY MEDIA",
  };
  await assert.rejects(
    applyManifest(manifest, apply, f),
    /CUTOVER_PARTIAL_FAILURE/,
  );
  assert(!f.records.has(one));
  assert(f.records.has(two));
  assert(!f.events.includes(`detach:${two}`));
  f.fail(undefined);
  await applyManifest(manifest, apply, f);
  assert.equal(f.records.size, 0);
});
test("tampered keys, provider changes and changed ETag fail closed", async () => {
  for (const kind of ["key", "provider", "etag"]) {
    const f = fixture();
    const manifest = await buildManifest(options, f);
    if (kind === "key") manifest.media[0].objects[0].key = "*";
    if (kind === "provider") f.records.get(one).storage_provider = "supabase";
    if (kind === "etag")
      f.objects.get(row(one).original_object_key).etag = '"changed"';
    await assert.rejects(
      applyManifest(
        manifest,
        { ...options, dryRun: false, confirmation: "DELETE ALL LEGACY MEDIA" },
        f,
      ),
    );
    assert.equal(f.events.length, 0);
    assert(f.records.has(one));
  }
});

test("database adapter detaches exact references before deleting media and rolls back failure", async () => {
  for (const failDelete of [false, true]) {
    const calls = [];
    const db = createDatabaseAdapter({
      query: async (sql, args) => {
        calls.push([sql, args]);
        if (sql.startsWith("select")) return { rows: [row(one)] };
        if (sql.startsWith("delete from public.media where"))
          return { rowCount: failDelete ? 0 : 1 };
        return { rows: [] };
      },
    });
    const operation = db.withLockedRow(one, async (current, remove) => {
      assert.equal(current.id, one);
      await remove();
    });
    if (failDelete)
      await assert.rejects(operation, /CUTOVER_ROW_DELETE_FAILED/);
    else await operation;
    assert.deepEqual(calls.slice(2, 7), [
      [
        "update public.profiles set avatar_media_id = null where avatar_media_id = $1",
        [one],
      ],
      [
        "update public.profiles set cover_media_id = null where cover_media_id = $1",
        [one],
      ],
      ["delete from public.vehicle_media where media_id = $1", [one]],
      ["delete from public.media_variants where media_id = $1", [one]],
      [
        "delete from public.media where id = $1 and storage_provider = 'r2' returning id",
        [one],
      ],
    ]);
    assert.equal(calls.at(-1)[0], failDelete ? "rollback" : "commit");
  }
});
test("S3 adapter treats partial 200 responses as failure and only treats 404 as missing", async () => {
  class HeadObjectCommand {
    constructor(input) {
      this.input = input;
    }
  }
  class DeleteObjectsCommand {
    constructor(input) {
      this.input = input;
    }
  }
  const storage = createStorageAdapter(
    {
      send: async (command) => {
        assert.equal(command.input.Bucket, "iride");
        if (command instanceof DeleteObjectsCommand) {
          assert.deepEqual(command.input.Delete.Objects, [
            { Key: "a" },
            { Key: "b" },
          ]);
          return {
            Deleted: [{ Key: "a" }],
            Errors: [{ Key: "b", Code: "AccessDenied" }],
          };
        }
        throw {
          $metadata: {
            httpStatusCode: command.input.Key === "missing" ? 404 : 403,
          },
        };
      },
    },
    { HeadObjectCommand, DeleteObjectsCommand },
    "iride",
  );
  assert.deepEqual(await storage.removeBatch(["a", "b"]), [
    { key: "a", ok: true },
    { key: "b", ok: false },
  ]);
  assert.equal(await storage.head("missing"), null);
  await assert.rejects(storage.head("denied"));
});

test("CLI rejects unsafe invocation before opening database or storage connections", () => {
  for (const env of [
    { DRY_RUN: "false", CONFIRM_PROJECT_REF: "wrong" },
    {
      DRY_RUN: "false",
      CONFIRM_PROJECT_REF: options.projectRef,
      CONFIRMATION: "yes",
    },
    { DRY_RUN: "maybe", CONFIRM_PROJECT_REF: options.projectRef },
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/media-storage-cutover.mjs", "export"],
      { encoding: "utf8", env },
    );
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /CUTOVER_(PROJECT_MISMATCH|CONFIRMATION_REQUIRED|DRY_RUN_INVALID)/,
    );
  }
});

test("missing DB row with surviving objects is reported, and failed commit is never reported deleted", async () => {
  for (const failure of ["missing", "commit"]) {
    const f = fixture([row(one)]);
    const manifest = await buildManifest(options, f);
    if (failure === "missing") f.records.delete(one);
    else {
      const withLockedRow = f.db.withLockedRow;
      f.db.withLockedRow = async (...args) => {
        await withLockedRow(...args);
        throw new Error("commit failed");
      };
    }
    await assert.rejects(
      applyManifest(
        manifest,
        { ...options, dryRun: false, confirmation: "DELETE ALL LEGACY MEDIA" },
        f,
      ),
      (error) => {
        assert.deepEqual(error.result.deleted, []);
        assert.deepEqual(error.result.failed, [one]);
        return true;
      },
    );
  }
});
