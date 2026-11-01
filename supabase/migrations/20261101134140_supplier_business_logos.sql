-- Business brand images are public assets attached to an approved storefront.
-- Keep them in the existing marketplace bucket and allow only business owners
-- and admins to attach a path belonging to their own business.
grant select (logo_path) on public.businesses to anon, authenticated;
grant update (logo_path) on public.businesses to authenticated;

create policy businesses_member_logo_update on public.businesses
  for update to authenticated
  using (private.is_business_member(id, array['owner', 'admin']))
  with check (
    private.is_business_member(id, array['owner', 'admin'])
    and (logo_path is null or split_part(logo_path, '/', 1) = id::text)
  );
