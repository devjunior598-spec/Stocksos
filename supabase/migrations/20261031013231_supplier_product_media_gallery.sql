-- Product listings can show a curated image gallery and an optional short video.
alter table public.products
  add column if not exists media_paths text[] not null default '{}';

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
where id = 'marketplace-images';
