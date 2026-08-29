begin;
select plan(22);

select has_table('public', 'media', 'media table exists');
select has_table('public', 'media_variants', 'media variants table exists');
select has_table('public', 'vehicles', 'vehicles table exists');
select has_table('public', 'vehicle_media', 'vehicle media table exists');
select has_table('public', 'comments', 'comments table exists');
select has_table('public', 'post_marker_tags', 'post marker tags table exists');
select has_table('public', 'market_products', 'market products table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.media'::regclass), 'media has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.vehicles'::regclass), 'vehicles have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.comments'::regclass), 'comments have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.market_products'::regclass), 'market products have RLS');

select col_is_fk('public', 'profiles', 'avatar_media_id', 'profiles avatar references media');
select col_is_fk('public', 'profiles', 'cover_media_id', 'profiles cover references media');
select col_is_fk('public', 'comments', 'post_id', 'comments reference posts');
select has_function('public', 'save_post_with_markers', array['uuid','text','jsonb'], 'atomic post save function exists');
select has_function('public', 'save_vehicle_with_media', array['uuid','jsonb','uuid[]'], 'atomic vehicle save function exists');
select ok(not has_table_privilege('authenticated', 'public.media', 'update'), 'clients cannot forge ready media state');

select throws_ok(
  $$insert into public.market_products(owner_id,name,price_satang,category,vehicle_kinds) values
    ('10000000-0000-4000-8000-000000000001','Invalid',-1,'Parts',array['car']::public.vehicle_kind[])$$,
  '23514', null, 'market price cannot be negative'
);

select throws_ok(
  $$insert into public.vehicles(owner_id,kind,brand,model,year,visibility) values
    ('10000000-0000-4000-8000-000000000001','car','Brand','Model',1800,'public')$$,
  '23514', null, 'vehicle year is constrained'
);

select is(
  (select count(*)::integer from pg_policies where schemaname='public' and tablename='comments' and cmd='UPDATE'),
  1,
  'comments have one owner update policy'
);

select is(
  (select count(*)::integer from pg_policies where schemaname='public' and tablename='market_products' and cmd='UPDATE'),
  1,
  'market products have one owner update policy'
);

update public.profiles set username='social_owner',display_name='Social Owner' where id='10000000-0000-4000-8000-000000000001';
update public.profiles set username='social_other',display_name='Social Other' where id='20000000-0000-4000-8000-000000000002';
set local role service_role;
insert into public.media(id,owner_id,purpose,status,original_object_key,filename,mime_type,bytes)
values
  ('71000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','vehicle','ready','users/owner/vehicle/one','one.webp','image/webp',10),
  ('72000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','vehicle','ready','users/other/vehicle/two','two.webp','image/webp',10);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.vehicles(id,owner_id,kind,brand,model,visibility)
values('73000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','motorcycle','Honda','Test','public');
insert into public.vehicle_media(vehicle_id,media_id,position,is_cover)
values('73000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000001',0,true);
select throws_ok(
  $$update public.vehicle_media set media_id='72000000-0000-4000-8000-000000000002' where vehicle_id='73000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'vehicle owner cannot link another owner media'
);
reset role;

select * from finish();
rollback;
