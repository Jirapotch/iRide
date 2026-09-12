const projection = `m.id, m.owner_id, m.purpose, m.storage_provider,
  m.original_object_key, m.bytes, m.status, m.created_at,
  coalesce((select jsonb_agg(v order by v.kind) from public.media_variants v where v.media_id = m.id), '[]'::jsonb) as variants,
  coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'avatar', p.avatar_media_id = m.id, 'cover', p.cover_media_id = m.id) order by p.id)
    from public.profiles p where p.avatar_media_id = m.id or p.cover_media_id = m.id), '[]'::jsonb) as profiles,
  coalesce((select jsonb_agg(vm order by vm.vehicle_id) from public.vehicle_media vm where vm.media_id = m.id), '[]'::jsonb) as vehicles`;

export function createDatabaseAdapter(client) {
  return {
    async list() {
      const { rows } = await client.query(
        `select ${projection} from public.media m where m.storage_provider = 'r2' and m.purpose in ('avatar', 'cover', 'vehicle') order by m.id`,
      );
      return rows;
    },
    async withLockedRow(id, callback) {
      await client.query("begin");
      try {
        const { rows } = await client.query(
          `select ${projection} from public.media m where m.id = $1 for update of m`,
          [id],
        );
        await callback(rows[0], async () => {
          await client.query(
            "update public.profiles set avatar_media_id = null where avatar_media_id = $1",
            [id],
          );
          await client.query(
            "update public.profiles set cover_media_id = null where cover_media_id = $1",
            [id],
          );
          await client.query(
            "delete from public.vehicle_media where media_id = $1",
            [id],
          );
          await client.query(
            "delete from public.media_variants where media_id = $1",
            [id],
          );
          const deleted = await client.query(
            "delete from public.media where id = $1 and storage_provider = 'r2' returning id",
            [id],
          );
          if (deleted.rowCount !== 1)
            throw new Error("CUTOVER_ROW_DELETE_FAILED");
        });
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    },
  };
}

export function createStorageAdapter(client, commands, bucket) {
  return {
    async head(key) {
      try {
        const result = await client.send(
          new commands.HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        if (
          !Number.isSafeInteger(result.ContentLength) ||
          result.ContentLength < 0 ||
          !result.ETag
        )
          throw new Error("CUTOVER_OBJECT_METADATA_INVALID");
        return { size: result.ContentLength, etag: result.ETag };
      } catch (error) {
        if (error.$metadata?.httpStatusCode === 404) return null;
        throw error;
      }
    },
    async removeBatch(keys) {
      const result = await client.send(
        new commands.DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: false },
        }),
      );
      return keys.map((key) => ({
        key,
        ok:
          !!result.Deleted?.some((item) => item.Key === key) &&
          !result.Errors?.some((item) => item.Key === key),
      }));
    },
  };
}
