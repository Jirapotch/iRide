update storage.buckets
set file_size_limit = 3000000
where id in ('avatars', 'vehicle-media', 'post-media');
