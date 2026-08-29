begin;
select plan(18);

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

select * from finish();
rollback;
