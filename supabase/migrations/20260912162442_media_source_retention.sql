create or replace function public.finish_media_processing(target_media_id uuid, source_width integer, source_height integer, variants jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  media_row public.media%rowtype;
begin
  select * into media_row from public.media where id = target_media_id for update;
  if not found or media_row.deleted_at is not null then
    raise exception using errcode = 'P0002', message = 'media_processing_not_found';
  end if;
  -- A redelivered queue message must not regenerate variants or duplicate cleanup.
  if media_row.status = 'ready' then return; end if;
  if media_row.status <> 'processing' or media_row.original_object_key is null then
    raise exception using errcode = 'P0002', message = 'media_processing_not_found';
  end if;
  if jsonb_typeof(variants) is distinct from 'array' or jsonb_array_length(variants) <> 2 then
    raise exception using errcode = '22023', message = 'media_variants_invalid';
  end if;
  delete from public.media_variants where media_id = target_media_id;
  insert into public.media_variants(media_id, kind, object_key, bytes, width, height)
  select target_media_id, item.kind::public.media_variant_kind, item.object_key, item.bytes, item.width, item.height
  from jsonb_to_recordset(variants) as item(kind text, object_key text, bytes bigint, width integer, height integer);
  update public.media set status = 'ready', width = source_width, height = source_height, failure_reason = null
  where id = target_media_id;
  -- Signed upload tokens remain replayable for two hours. Keep the source in place
  -- until every token issued while uploading expires; upsert=false prevents replacement.
  -- This enqueue and ready transition roll back together on any database/queue error.
  perform public.enqueue_job('media_cleanup', jsonb_build_object(
    'version', 1, 'jobId', extensions.gen_random_uuid(),
    'idempotencyKey', 'media:' || target_media_id::text || ':source', 'attempt', 0,
    'objects', jsonb_build_array(jsonb_build_object(
      'objectKey', media_row.original_object_key,
      'storageProvider', media_row.storage_provider,
      'sourceMediaId', target_media_id
    ))
  ), 7200);
end;
$$;
revoke all on function public.finish_media_processing(uuid, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.finish_media_processing(uuid, integer, integer, jsonb) to service_role;
