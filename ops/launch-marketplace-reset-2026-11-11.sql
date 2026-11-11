-- One-time owner-requested launch reset of the two reviewed supplier shops.
-- Audit records and private media copies must exist before removing live rows.
-- Do not use this script for a general marketplace reset.
begin;

do $$
declare
  expected_businesses uuid[] := array[
    '0f94f20e-8325-4d7c-9eac-7f459db6e9ea'::uuid,
    '81d13479-d25c-454f-baf5-ebfa9d9dd287'::uuid
  ];
  expected_products uuid[] := array[
    '268cc57e-5b43-42f2-92aa-6722d3f96e84'::uuid,
    'eedea8c9-915e-49f4-8f71-e5494c9df885'::uuid
  ];
  deleted_count integer;
begin
  lock table public.businesses, public.products in share row exclusive mode;

  if (select coalesce(array_agg(id order by id), array[]::uuid[]) from public.businesses)
      <> expected_businesses
    or (select coalesce(array_agg(id order by id), array[]::uuid[]) from public.products)
      <> expected_products then
    raise exception 'Marketplace records changed since the launch reset review';
  end if;

  if exists (select 1 from public.orders)
    or exists (select 1 from public.quotations)
    or exists (select 1 from public.payments)
    or exists (select 1 from public.reviews)
    or exists (select 1 from public.business_subscriptions)
    or exists (select 1 from public.stock_reservations)
    or exists (select 1 from public.supplier_matches)
    or exists (select 1 from public.business_enquiries)
    or exists (select 1 from public.supplier_verification_files)
    or exists (select 1 from public.sales_assistant_entitlements)
    or exists (select 1 from public.sales_assistant_settings)
    or exists (select 1 from public.saved_suppliers) then
    raise exception 'Dependent marketplace records exist; do not delete shops';
  end if;

  if (select count(*) from storage.buckets where id = 'launch-archive' and public = false) <> 1
    or (select count(*) from storage.objects where bucket_id = 'marketplace-images') <> 2
    or (select count(*) from storage.objects where bucket_id = 'launch-archive') <> 2
    or exists (
      select 1 from storage.objects original
      left join storage.objects archived on archived.bucket_id = 'launch-archive'
        and archived.name = original.name
        and archived.metadata->>'size' = original.metadata->>'size'
      where original.bucket_id = 'marketplace-images' and archived.id is null
    ) then
    raise exception 'Private media archive is incomplete';
  end if;

  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
  select null, 'launch_store_removed', 'business', b.id,
    jsonb_build_object(
      'reason', 'Platform owner requested an empty marketplace for launch',
      'business', to_jsonb(b),
      'products', coalesce((select jsonb_agg(to_jsonb(p)) from public.products p where p.business_id = b.id), '[]'::jsonb),
      'inventory', coalesce((select jsonb_agg(to_jsonb(i)) from public.inventory i join public.products p on p.id = i.product_id where p.business_id = b.id), '[]'::jsonb),
      'memberships', coalesce((select jsonb_agg(to_jsonb(m)) from public.business_memberships m where m.business_id = b.id), '[]'::jsonb),
      'private_media_bucket', 'launch-archive',
      'private_media_paths', coalesce((select jsonb_agg(o.name) from storage.objects o where o.bucket_id = 'launch-archive' and o.name like b.id::text || '/%'), '[]'::jsonb)
    )
  from public.businesses b;

  delete from public.businesses where id = any(expected_businesses);
  get diagnostics deleted_count = row_count;
  if deleted_count <> 2 then raise exception 'Unexpected deletion count'; end if;
end $$;

commit;
