-- Reversible marketplace removal: preserve records for disputes and lawful investigations.
-- Apply only after the associated server code and retention policy are reviewed.

alter table public.products
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles(id),
  add column removal_reason text;

alter table public.profiles
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles(id),
  add column removal_reason text;

alter table public.profiles drop constraint profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('pending', 'approved', 'rejected', 'suspended', 'removed'));

create index products_removed_at_idx on public.products(removed_at desc) where removed_at is not null;
create index profiles_removed_at_idx on public.profiles(removed_at desc) where removed_at is not null;

-- Keep pre-change snapshots so an account owner cannot erase investigation
-- context by editing a profile, business or listing before removal.
create table public.record_history (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('profile','business','product')),
  subject_id uuid not null,
  actor_id uuid,
  operation text not null check (operation in ('UPDATE','DELETE')),
  previous_record jsonb not null,
  created_at timestamptz not null default now()
);
create index record_history_subject_idx on public.record_history(subject_type, subject_id, created_at desc);
alter table public.record_history enable row level security;
grant select on public.record_history to authenticated;
grant select, insert on public.record_history to service_role;
create policy record_history_admin_read on public.record_history for select to authenticated
  using (private.is_admin());

create function private.capture_marketplace_record_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then return new; end if;
  insert into public.record_history(subject_type, subject_id, actor_id, operation, previous_record)
  values (case tg_table_name
      when 'profiles' then 'profile' when 'businesses' then 'business' else 'product' end,
    old.id, auth.uid(), tg_op, to_jsonb(old));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.capture_marketplace_record_history() from public, anon, authenticated;
create trigger capture_profile_history before update or delete on public.profiles
  for each row execute function private.capture_marketplace_record_history();
create trigger capture_business_history before update or delete on public.businesses
  for each row execute function private.capture_marketplace_record_history();
create trigger capture_product_history before update or delete on public.products
  for each row execute function private.capture_marketplace_record_history();

create or replace function private.is_business_member(p_business_id uuid, p_roles text[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.business_memberships bm
    join public.profiles member on member.id = bm.user_id
    where bm.business_id = p_business_id and bm.user_id = auth.uid()
      and member.removed_at is null
      and (p_roles is null or bm.role = any(p_roles))
  );
$$;

-- Only admins can see removed product metadata. The supplier loses access after removal.
drop policy products_public_read on public.products;
create policy products_public_read on public.products for select to anon using (
  removed_at is null and is_active and visibility = 'public' and exists (
    select 1 from public.businesses b where b.id = business_id
      and b.verification_status = 'approved' and b.visibility = 'public'
  )
);
drop policy products_member_read on public.products;
create policy products_member_read on public.products for select to authenticated using (
  private.is_admin() or (removed_at is null and (
    (is_active and visibility = 'public' and exists (
      select 1 from public.businesses b where b.id = business_id
        and b.verification_status = 'approved' and b.visibility = 'public'
    )) or private.is_business_member(business_id)
  ))
);

drop policy inventory_member_read on public.inventory;
create policy inventory_member_read on public.inventory for select to authenticated using (
  private.is_admin() or exists (
    select 1 from public.products p join public.businesses b on b.id = p.business_id
    where p.id = product_id and p.removed_at is null and (
      (p.is_active and p.visibility = 'public' and b.verification_status = 'approved' and b.visibility = 'public')
      or private.is_business_member(p.business_id)
    )
  )
);
drop policy inventory_member_update on public.inventory;
create policy inventory_member_update on public.inventory for update to authenticated
  using (exists (select 1 from public.products p where p.id = inventory.product_id
    and p.removed_at is null and private.is_business_member(p.business_id, array['owner','admin','inventory'])))
  with check (exists (select 1 from public.products p where p.id = inventory.product_id
    and p.removed_at is null and private.is_business_member(p.business_id, array['owner','admin','inventory'])));
revoke delete on public.products from authenticated;
grant select (removed_at, removed_by, removal_reason) on public.products to authenticated;
grant select (removed_at, removed_by, removal_reason) on public.profiles to authenticated;

create function private.prevent_removed_product_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Products must be archived, not deleted' using errcode = '42501';
  end if;
  if old.removed_at is not null then
    raise exception 'Archived products cannot be edited' using errcode = '42501';
  end if;
  if new.removed_at is not null and auth.uid() is null then
    raise exception 'Use an authenticated removal action' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_removed_product_change() from public, anon, authenticated;
create trigger prevent_removed_product_change before update or delete on public.products
for each row execute function private.prevent_removed_product_change();

create function public.remove_supplier_product(p_product_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_product public.products%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_product from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found' using errcode = 'P0002'; end if;
  if not (private.is_admin() or private.is_business_member(v_product.business_id, array['owner','admin'])) then
    raise exception 'Product removal requires business ownership' using errcode = '42501';
  end if;
  if v_product.removed_at is not null then return; end if;
  update public.products set is_active = false, visibility = 'private',
    removed_at = now(), removed_by = auth.uid(),
    removal_reason = nullif(left(trim(coalesce(p_reason,'')), 500), ''), updated_at = now()
  where id = p_product_id;
  insert into public.audit_logs(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'product_removed', 'product', p_product_id,
    jsonb_build_object('business_id', v_product.business_id, 'name', v_product.name,
      'reason', left(coalesce(p_reason,''), 500)));
end;
$$;
revoke all on function public.remove_supplier_product(uuid, text) from public, anon;
grant execute on function public.remove_supplier_product(uuid, text) to authenticated;

-- A product-page request reaches that product's supplier even when buyer and
-- supplier are in different cities. The accepted quotation still creates the order.
create function public.create_product_sos_request(
  p_product_id uuid, p_category_id uuid, p_product_name text, p_quantity integer,
  p_country text, p_region text, p_city text, p_postal_code text, p_area text,
  p_delivery_method text, p_urgency text, p_specifications text default null,
  p_preferred_condition text default 'any', p_scheduled_at timestamptz default null,
  p_notes text default null, p_photo_path text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_request_id uuid; v_business_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select p.business_id into v_business_id
  from public.products p
  join public.businesses b on b.id = p.business_id
  join public.inventory i on i.product_id = p.id
  where p.id = p_product_id and p.category_id = p_category_id
    and lower(trim(p.name)) = lower(trim(p_product_name))
    and p.removed_at is null and p.is_active and p.visibility = 'public'
    and b.verification_status = 'approved' and b.visibility = 'public'
    and i.quantity_available >= p_quantity;
  if not found then
    raise exception 'This product is no longer available in the requested quantity' using errcode = '22023';
  end if;
  v_request_id := public.create_sos_request(
    p_category_id => p_category_id, p_product_name => p_product_name,
    p_quantity => p_quantity, p_country => p_country, p_region => p_region,
    p_city => p_city, p_postal_code => p_postal_code, p_area => p_area,
    p_delivery_method => p_delivery_method, p_urgency => p_urgency,
    p_specifications => p_specifications, p_preferred_condition => p_preferred_condition,
    p_scheduled_at => p_scheduled_at, p_notes => p_notes, p_photo_path => p_photo_path
  );
  -- The standard SOS function searches all local suppliers. A buyer who chose a
  -- specific product contacts only the selected supplier.
  delete from public.supplier_matches
    where request_id = v_request_id and business_id <> v_business_id;
  delete from public.notifications
    where entity_type = 'sos_request' and entity_id = v_request_id
      and kind = 'matching_request'
      and user_id not in (
        select bm.user_id from public.business_memberships bm where bm.business_id = v_business_id
      );
  delete from public.notification_jobs
    where event_key like 'sos-email:' || v_request_id::text || ':%'
      and user_id not in (
        select bm.user_id from public.business_memberships bm where bm.business_id = v_business_id
      );
  insert into public.supplier_matches(request_id, business_id, match_score, reason_codes)
  values (v_request_id, v_business_id, 100, array['buyer_selected_product','verified_supplier','stock_available'])
  on conflict (request_id, business_id) do nothing;
  insert into public.notifications(user_id, event_key, kind, title, body, entity_type, entity_id)
  select bm.user_id, 'sos:' || v_request_id::text || ':' || bm.user_id::text,
    'matching_request', 'A buyer requested your listed product',
    'Open your supplier workspace to review the request and send a quotation.',
    'sos_request', v_request_id
  from public.business_memberships bm
  join public.profiles member on member.id = bm.user_id and member.removed_at is null
  where bm.business_id = v_business_id and bm.role in ('owner','admin','fulfillment')
  on conflict (event_key) do nothing;
  insert into public.notification_jobs(event_key, user_id, channel, payload)
  select 'sos-email:' || v_request_id::text || ':' || bm.user_id::text,
    bm.user_id, 'email', jsonb_build_object('kind','matching_request','request_id',v_request_id)
  from public.business_memberships bm
  join public.profiles member on member.id = bm.user_id and member.removed_at is null
  where bm.business_id = v_business_id and bm.role in ('owner','admin','fulfillment')
  on conflict (event_key) do nothing;
  return v_request_id;
end;
$$;
revoke all on function public.create_product_sos_request(uuid, uuid, text, integer, text, text, text, text, text, text, text, text, text, timestamptz, text, text) from public, anon;
grant execute on function public.create_product_sos_request(uuid, uuid, text, integer, text, text, text, text, text, text, text, text, text, timestamptz, text, text) to authenticated;

-- Remove a marketplace account without destroying order, dispute or audit evidence.
create function public.admin_remove_marketplace_account(p_user_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles%rowtype;
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason,''))) < 10 then
    raise exception 'A removal reason of at least 10 characters is required' using errcode = '22023';
  end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Account not found' using errcode = 'P0002'; end if;
  if v_profile.platform_role <> 'user' then
    raise exception 'Staff accounts cannot be removed here' using errcode = '42501';
  end if;
  if v_profile.removed_at is not null then return; end if;
  if exists (
    select 1 from public.business_memberships owned
    join public.business_memberships other_owner
      on other_owner.business_id = owned.business_id and other_owner.role = 'owner'
      and other_owner.user_id <> p_user_id
    join public.profiles other_profile on other_profile.id = other_owner.user_id
    where owned.user_id = p_user_id and owned.role = 'owner'
      and other_profile.removed_at is null
  ) then
    raise exception 'Transfer shared business ownership before removing this account'
      using errcode = '22023';
  end if;
  update public.profiles set account_status = 'removed', removed_at = now(),
    removed_by = auth.uid(), removal_reason = left(trim(p_reason),500),
    account_review_note = 'Removed from marketplace', account_reviewed_by = auth.uid(),
    account_reviewed_at = now(), updated_at = now() where id = p_user_id;
  update public.businesses set verification_status = 'suspended', visibility = 'private', updated_at = now()
  where id in (select business_id from public.business_memberships where user_id = p_user_id and role = 'owner');
  update public.products set is_active = false, visibility = 'private',
    removed_at = now(), removed_by = auth.uid(), removal_reason = 'Supplier account removed', updated_at = now()
  where business_id in (select business_id from public.business_memberships where user_id = p_user_id and role = 'owner')
    and removed_at is null;
  insert into public.audit_logs(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'account_removed', 'profile', p_user_id,
    jsonb_build_object('marketplace_role', v_profile.marketplace_role, 'reason', left(trim(p_reason),500)));
end;
$$;
revoke all on function public.admin_remove_marketplace_account(uuid, text) from public, anon;
grant execute on function public.admin_remove_marketplace_account(uuid, text) to authenticated;

create function public.admin_removed_accounts()
returns table (
  id uuid, email text, full_name text, phone text, marketplace_role text,
  removed_at timestamptz, removal_reason text, removed_by uuid
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  return query
    select p.id, u.email::text, p.full_name, p.phone, p.marketplace_role,
      p.removed_at, p.removal_reason, p.removed_by
    from public.profiles p join auth.users u on u.id = p.id
    where p.removed_at is not null
    order by p.removed_at desc;
end;
$$;
revoke all on function public.admin_removed_accounts() from public, anon;
grant execute on function public.admin_removed_accounts() to authenticated;

-- Existing review actions cannot silently restore a removed account.
create function private.prevent_removed_account_restore()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.removed_at is not null and new.account_status <> 'removed' then
    raise exception 'Removed accounts require a separate restoration review' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_removed_account_restore() from public, anon, authenticated;
create trigger prevent_removed_account_restore before update on public.profiles
for each row execute function private.prevent_removed_account_restore();

-- Preserve archived media in a non-public bucket. Server code copies bytes before removing originals.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace-evidence', 'marketplace-evidence', false, 52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do nothing;

create table public.removal_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id),
  business_id uuid references public.businesses(id),
  original_path text not null,
  evidence_path text not null unique,
  archived_at timestamptz not null default now(),
  constraint removal_media_one_subject check ((product_id is not null) <> (business_id is not null))
);
create index removal_media_product_idx on public.removal_media(product_id);
create index removal_media_business_idx on public.removal_media(business_id);
alter table public.removal_media enable row level security;
grant select on public.removal_media to authenticated;
grant select, insert, update on public.removal_media to service_role;
create policy removal_media_admin_read on public.removal_media for select to authenticated
  using (private.is_admin());

create function private.account_not_removed()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.removed_at is null
  );
$$;
revoke all on function private.account_not_removed() from public, anon;
grant execute on function private.account_not_removed() to authenticated, service_role;

-- RLS continues to deny direct Data API access after account removal, including
-- while a previously issued JWT is still valid. Profiles remain readable by self
-- so the account-status screen can explain the removal.
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'businesses','business_memberships','supplier_verification_files','products','inventory',
    'sos_requests','supplier_matches','quotations','order_groups','orders','order_items',
    'stock_reservations','payments','refunds','delivery_partners','deliveries',
    'notifications','notification_jobs','business_subscriptions','saved_suppliers',
    'reviews','business_enquiries','support_cases','audit_logs','platform_settings'
  ] loop
    execute format(
      'create policy account_not_removed on public.%I as restrictive for all to authenticated using (private.account_not_removed()) with check (private.account_not_removed())',
      v_table
    );
  end loop;
end;
$$;

-- An existing access token must not let a removed account mutate marketplace data.
create function private.reject_removed_actor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.removed_at is not null
  ) then
    raise exception 'This account no longer has marketplace access' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.reject_removed_actor() from public, anon, authenticated;
create trigger removed_actor_profiles before update on public.profiles
  for each row execute function private.reject_removed_actor();
create trigger removed_actor_businesses before insert or update or delete on public.businesses
  for each row execute function private.reject_removed_actor();
create trigger removed_actor_products before insert or update on public.products
  for each row execute function private.reject_removed_actor();
create trigger removed_actor_inventory before insert or update or delete on public.inventory
  for each row execute function private.reject_removed_actor();
create trigger removed_actor_sos before insert or update or delete on public.sos_requests
  for each row execute function private.reject_removed_actor();
create trigger removed_actor_quotations before insert or update or delete on public.quotations
  for each row execute function private.reject_removed_actor();
create trigger removed_actor_orders before insert or update or delete on public.orders
  for each row execute function private.reject_removed_actor();
create trigger removed_actor_enquiries before insert or update or delete on public.business_enquiries
  for each row execute function private.reject_removed_actor();
create trigger removed_actor_support before insert or update or delete on public.support_cases
  for each row execute function private.reject_removed_actor();
