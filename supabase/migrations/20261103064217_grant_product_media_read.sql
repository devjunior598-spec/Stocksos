-- Gallery paths were added after the restricted product SELECT grants.
-- Existing product RLS still limits anonymous users to active public listings
-- and signed-in users to public, owned, or admin-visible listings.
grant select (media_paths) on public.products to anon, authenticated;
