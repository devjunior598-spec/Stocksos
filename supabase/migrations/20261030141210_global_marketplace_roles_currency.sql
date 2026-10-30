-- Global marketplace roles, locations and US-dollar launch currency.
-- Existing marketplace financial rows are intentionally required to be empty so
-- amounts are never relabelled from NGN to USD without an explicit conversion.

alter table public.profiles
  add column if not exists marketplace_role text not null default 'buyer';

alter table public.profiles
  drop constraint if exists profiles_marketplace_role_check,
  add constraint profiles_marketplace_role_check check (marketplace_role in ('buyer', 'supplier'));

update public.profiles p
set marketplace_role = 'supplier'
where exists (select 1 from public.business_memberships bm where bm.user_id = p.id);

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, marketplace_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'marketplace_role' = 'supplier' then 'supplier' else 'buyer' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

grant update (
  full_name, phone, home_city, home_country, home_region, home_postal_code,
  home_area, home_address, default_delivery_method, updated_at
) on public.profiles to authenticated;

alter table public.businesses
  add column if not exists country char(2) not null default 'US',
  add column if not exists region text,
  add column if not exists postal_code text;

alter table public.businesses
  drop constraint if exists businesses_country_check,
  add constraint businesses_country_check check (country ~ '^[A-Z]{2}$');

grant select (country, region, postal_code) on public.businesses to anon, authenticated;

alter table public.sos_requests
  add column if not exists country char(2) not null default 'US',
  add column if not exists region text,
  add column if not exists postal_code text;

alter table public.sos_requests
  drop constraint if exists sos_requests_country_check,
  add constraint sos_requests_country_check check (country ~ '^[A-Z]{2}$');

do $$
begin
  if exists (select 1 from public.inventory)
    or exists (select 1 from public.quotations)
    or exists (select 1 from public.order_groups)
    or exists (select 1 from public.orders)
    or exists (select 1 from public.payments) then
    raise exception 'USD launch migration requires an empty financial marketplace; review existing records before applying';
  end if;
end;
$$;

alter table public.inventory
  drop constraint if exists inventory_currency_check,
  alter column currency set default 'USD',
  add constraint inventory_currency_check check (currency = 'USD');

alter table public.quotations
  add column if not exists currency char(3) not null default 'USD';

alter table public.quotations
  drop constraint if exists quotations_currency_check,
  add constraint quotations_currency_check check (currency = 'USD');

alter table public.order_groups
  drop constraint if exists order_groups_currency_check,
  alter column currency set default 'USD',
  add constraint order_groups_currency_check check (currency = 'USD');

alter table public.orders
  drop constraint if exists orders_currency_check,
  alter column currency set default 'USD',
  add constraint orders_currency_check check (currency = 'USD');

alter table public.payments
  drop constraint if exists payments_currency_check,
  alter column currency set default 'USD',
  add constraint payments_currency_check check (currency = 'USD');

-- Global launch pricing; payment collection remains disabled until a global
-- provider and settlement model are approved.
update public.subscription_plans set monthly_price_kobo = case id
  when 'supplier-pro' then 900
  when 'wholesaler-pro' then 2900
  else monthly_price_kobo
end, updated_at = now()
where id in ('supplier-pro', 'wholesaler-pro');

drop function public.create_business_application(text, text, uuid, text, text, text, text, text, text);

create function public.create_business_application(
  p_name text, p_slug text, p_category_id uuid, p_country text, p_region text,
  p_city text, p_postal_code text default null, p_area text default null,
  p_phone text default null, p_email text default null, p_description text default null,
  p_registration_number text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_business_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.marketplace_role = 'supplier'
  ) then
    raise exception 'A supplier account is required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 120
    or length(trim(coalesce(p_city, ''))) not between 2 and 100
    or length(trim(coalesce(p_region, ''))) not between 2 and 100
    or upper(trim(coalesce(p_country, ''))) !~ '^[A-Z]{2}$'
    or coalesce(p_slug, '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Invalid business details' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories c where c.id = p_category_id and c.is_active) then
    raise exception 'Select an active business category' using errcode = '22023';
  end if;
  insert into public.businesses (
    name, slug, primary_category_id, country, region, city, postal_code, area,
    phone, email, description, registration_number, created_by
  ) values (
    trim(p_name), lower(trim(p_slug)), p_category_id, upper(trim(p_country)), trim(p_region),
    trim(p_city), nullif(trim(p_postal_code), ''), nullif(trim(p_area), ''),
    nullif(trim(p_phone), ''), nullif(lower(trim(p_email)), ''),
    nullif(trim(p_description), ''), nullif(trim(p_registration_number), ''), v_user_id
  ) returning id into v_business_id;
  insert into public.business_memberships (business_id, user_id, role)
    values (v_business_id, v_user_id, 'owner');
  insert into public.audit_logs (actor_id, action, target_type, target_id)
    values (v_user_id, 'business_application_created', 'business', v_business_id);
  return v_business_id;
end;
$$;

drop function public.create_sos_request(uuid, text, integer, text, text, text, text, text, text, timestamptz, text, text);

create function public.create_sos_request(
  p_category_id uuid, p_product_name text, p_quantity integer, p_country text,
  p_region text, p_city text, p_postal_code text, p_area text,
  p_delivery_method text, p_urgency text, p_specifications text default null,
  p_preferred_condition text default 'any', p_scheduled_at timestamptz default null,
  p_notes text default null, p_photo_path text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_request_id uuid;
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_expiry_hours integer;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.profiles p where p.id = v_user_id and p.marketplace_role = 'buyer'
  ) then
    raise exception 'A buyer account is required' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity not between 1 and 1000000
    or length(trim(coalesce(p_product_name, ''))) not between 2 and 180
    or length(trim(coalesce(p_city, ''))) not between 2 and 100
    or length(trim(coalesce(p_region, ''))) not between 2 and 100
    or upper(trim(coalesce(p_country, ''))) !~ '^[A-Z]{2}$'
    or p_delivery_method not in ('pickup', 'delivery', 'flexible')
    or p_urgency not in ('immediately', 'within_30_minutes', 'within_2_hours', 'today', 'scheduled')
    or coalesce(p_preferred_condition, 'any') not in ('new', 'used', 'refurbished', 'any')
    or (p_urgency = 'scheduled' and p_scheduled_at is null) then
    raise exception 'Invalid SOS request details' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories c where c.id = p_category_id and c.is_active) then
    raise exception 'Select an active product category' using errcode = '22023';
  end if;
  select greatest(1, least(168, coalesce((ps.value #>> '{}')::integer, 24)))
    into v_expiry_hours from public.platform_settings ps where ps.key = 'default_sos_expiry_hours';
  v_expiry_hours := coalesce(v_expiry_hours, 24);
  insert into public.sos_requests (
    requester_id, category_id, product_name, quantity, country, region, city, postal_code,
    area, delivery_method, urgency, specifications, preferred_condition, scheduled_at,
    notes, photo_path, expires_at
  ) values (
    v_user_id, p_category_id, trim(p_product_name), p_quantity, upper(trim(p_country)),
    trim(p_region), trim(p_city), nullif(trim(p_postal_code), ''), nullif(trim(p_area), ''),
    p_delivery_method, p_urgency, nullif(trim(p_specifications), ''),
    coalesce(p_preferred_condition, 'any'), p_scheduled_at, nullif(trim(p_notes), ''),
    p_photo_path, now() + make_interval(hours => v_expiry_hours)
  ) returning id into v_request_id;
  for v_business_id in
    select b.id
    from public.businesses b
    where b.verification_status = 'approved'
      and b.primary_category_id = p_category_id
      and b.country = upper(trim(p_country))
      and lower(trim(b.city)) = lower(trim(p_city))
      and exists (
        select 1 from public.products p join public.inventory i on i.product_id = p.id
        where p.business_id = b.id and p.category_id = p_category_id
          and p.is_active and p.visibility = 'public' and i.quantity_available > 0
      )
    order by b.created_at
    limit 50
  loop
    insert into public.supplier_matches (request_id, business_id, match_score, reason_codes)
      values (v_request_id, v_business_id, 100,
        array['category_match', 'country_match', 'city_match', 'verified_supplier', 'stock_available'])
      on conflict (request_id, business_id) do nothing;
    insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
    select bm.user_id, 'sos:' || v_request_id::text || ':' || bm.user_id::text,
      'matching_request', 'A local SOS request matches your stock',
      'Open your supplier workspace to review the request and send a quotation.',
      'sos_request', v_request_id
    from public.business_memberships bm
    where bm.business_id = v_business_id and bm.role in ('owner', 'admin', 'fulfillment')
    on conflict (event_key) do nothing;
    insert into public.notification_jobs (event_key, user_id, channel, payload)
    select 'sos-email:' || v_request_id::text || ':' || bm.user_id::text,
      bm.user_id, 'email', jsonb_build_object('kind', 'matching_request', 'request_id', v_request_id)
    from public.business_memberships bm
    where bm.business_id = v_business_id and bm.role in ('owner', 'admin', 'fulfillment')
    on conflict (event_key) do nothing;
  end loop;
  return v_request_id;
end;
$$;

create or replace function public.submit_quotation(
  p_request_id uuid, p_business_id uuid, p_product_id uuid,
  p_unit_price_kobo bigint, p_quantity_offered integer,
  p_delivery_fee_kobo bigint, p_delivery_available boolean,
  p_preparation_minutes integer, p_note text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.sos_requests%rowtype;
  v_quote_id uuid;
  v_buyer_id uuid;
  v_available integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_request from public.sos_requests where id = p_request_id for update;
  if not found or v_request.status <> 'open' or v_request.expires_at <= now() then
    raise exception 'Request is no longer open' using errcode = '22023';
  end if;
  if p_unit_price_kobo is null or p_unit_price_kobo <= 0
    or p_quantity_offered is null or p_quantity_offered <= 0
    or p_delivery_fee_kobo is null or p_delivery_fee_kobo < 0
    or (not coalesce(p_delivery_available, false) and p_delivery_fee_kobo > 0)
    or p_preparation_minutes is not null and p_preparation_minutes not between 0 and 10080 then
    raise exception 'Invalid quotation details' using errcode = '22023';
  end if;
  if not private.is_business_member(p_business_id, array['owner', 'admin', 'fulfillment'])
    or not exists (select 1 from public.businesses b
      where b.id = p_business_id and b.verification_status = 'approved')
    or not exists (select 1 from public.supplier_matches sm
      where sm.request_id = p_request_id and sm.business_id = p_business_id
        and sm.status in ('matched', 'viewed')) then
    raise exception 'This business is not eligible to quote on the request' using errcode = '42501';
  end if;
  if p_product_id is not null then
    select i.quantity_available into v_available
      from public.products p join public.inventory i on i.product_id = p.id
      where p.id = p_product_id and p.business_id = p_business_id
        and p.category_id = v_request.category_id and p.is_active
      for update of i;
    if not found or v_available < p_quantity_offered then
      raise exception 'The selected inventory does not cover this offer' using errcode = '22023';
    end if;
  end if;
  insert into public.quotations (
    request_id, business_id, supplier_user_id, product_id, unit_price_kobo,
    quantity_offered, delivery_fee_kobo, delivery_available, preparation_minutes, note, currency
  ) values (
    p_request_id, p_business_id, auth.uid(), p_product_id, p_unit_price_kobo,
    p_quantity_offered, p_delivery_fee_kobo, p_delivery_available, p_preparation_minutes,
    nullif(trim(p_note), ''), 'USD'
  ) returning id into v_quote_id;
  update public.supplier_matches set status = 'quoted'
    where request_id = p_request_id and business_id = p_business_id;
  v_buyer_id := v_request.requester_id;
  insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
  values (v_buyer_id, 'quote:' || v_quote_id::text || ':submitted', 'quotation_received',
    'A supplier sent a quotation', 'Compare the offer in your buyer dashboard.', 'quotation', v_quote_id)
  on conflict (event_key) do nothing;
  return v_quote_id;
end;
$$;

create or replace function public.accept_quotation(p_quotation_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_quote public.quotations%rowtype;
  v_request public.sos_requests%rowtype;
  v_request_id uuid;
  v_order_id uuid;
  v_group_id uuid;
  v_subtotal bigint;
  v_delivery_fee bigint;
  v_fee bigint;
  v_available integer;
  v_fee_bps integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select q.request_id into v_request_id from public.quotations q where q.id = p_quotation_id;
  if not found then raise exception 'Quotation not found' using errcode = 'P0002'; end if;
  select * into v_request from public.sos_requests where id = v_request_id for update;
  if v_request.requester_id <> auth.uid() then
    raise exception 'Quotation not found' using errcode = '42501';
  end if;
  select * into v_quote from public.quotations where id = p_quotation_id for update;
  if v_request.status <> 'open' or v_quote.status <> 'submitted' or v_quote.expires_at <= now() then
    raise exception 'This quotation is no longer available' using errcode = '22023';
  end if;
  if v_quote.quantity_offered < v_request.quantity then
    raise exception 'This offer does not cover the requested quantity' using errcode = '22023';
  end if;
  if v_request.delivery_method = 'delivery' and not v_quote.delivery_available then
    raise exception 'This supplier cannot deliver this request' using errcode = '22023';
  end if;
  if v_quote.product_id is not null then
    select i.quantity_available into v_available
      from public.inventory i where i.product_id = v_quote.product_id for update;
    if not found or v_available < v_request.quantity then
      raise exception 'Inventory is no longer available' using errcode = '22023';
    end if;
    update public.inventory set quantity_available = quantity_available - v_request.quantity,
      quantity_reserved = quantity_reserved + v_request.quantity, updated_at = now()
      where product_id = v_quote.product_id;
  end if;
  v_subtotal := v_quote.unit_price_kobo * v_request.quantity;
  v_delivery_fee := case when v_request.delivery_method <> 'pickup' and v_quote.delivery_available
    then v_quote.delivery_fee_kobo else 0 end;
  select coalesce((ps.value #>> '{}')::integer, 0) into v_fee_bps
    from public.platform_settings ps where ps.key = 'marketplace_fee_bps';
  v_fee := ceil(v_subtotal::numeric * coalesce(v_fee_bps, 0) / 10000)::bigint;
  insert into public.order_groups (request_id, buyer_id, currency)
    values (v_request.id, auth.uid(), v_quote.currency) returning id into v_group_id;
  insert into public.orders (
    group_id, request_id, quotation_id, buyer_id, business_id,
    subtotal_kobo, delivery_fee_kobo, platform_fee_kobo, total_kobo, currency
  ) values (
    v_group_id, v_request.id, v_quote.id, auth.uid(), v_quote.business_id,
    v_subtotal, v_delivery_fee, v_fee, v_subtotal + v_delivery_fee + v_fee, v_quote.currency
  ) returning id into v_order_id;
  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price_kobo)
    values (v_order_id, v_quote.product_id, v_request.product_name, v_request.quantity, v_quote.unit_price_kobo);
  if v_quote.product_id is not null then
    insert into public.stock_reservations (product_id, order_id, quantity)
      values (v_quote.product_id, v_order_id, v_request.quantity);
  end if;
  update public.sos_requests set status = 'accepted', updated_at = now() where id = v_request.id;
  update public.quotations set status = case when id = v_quote.id then 'accepted' else 'expired' end
    where request_id = v_request.id and status = 'submitted';
  update public.supplier_matches set status = case when business_id = v_quote.business_id then 'accepted' else 'expired' end
    where request_id = v_request.id;
  insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
  values
    (auth.uid(), 'order:' || v_order_id::text || ':created:buyer', 'order_created',
      'Your order is ready for confirmation', 'Review the order details to continue.', 'order', v_order_id),
    (v_quote.supplier_user_id, 'order:' || v_order_id::text || ':created:supplier', 'order_created',
      'A buyer accepted your quotation', 'Open your supplier workspace to view the order.', 'order', v_order_id)
  on conflict (event_key) do nothing;
  return v_order_id;
end;
$$;

create or replace function public.create_business_enquiry(
  p_business_id uuid, p_product_name text, p_quantity integer, p_consent_to_referral boolean
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_enquiry_id uuid;
  v_business_name text;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.profiles p where p.id = v_user_id and p.marketplace_role = 'buyer'
  ) then
    raise exception 'A buyer account is required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_product_name, ''))) not between 2 and 180
    or p_quantity is null or p_quantity not between 1 and 1000000 then
    raise exception 'Invalid product enquiry' using errcode = '22023';
  end if;
  select b.name into v_business_name from public.businesses b
    where b.id = p_business_id and b.verification_status = 'approved' and b.visibility = 'public';
  if not found then raise exception 'Business profile is unavailable' using errcode = 'P0002'; end if;
  if (select count(*) from public.business_enquiries e
      where e.requester_id = v_user_id and e.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Please wait before sending more enquiries' using errcode = '22023';
  end if;
  insert into public.business_enquiries (business_id, requester_id, product_name, quantity, consent_to_referral)
    values (p_business_id, v_user_id, trim(p_product_name), p_quantity, coalesce(p_consent_to_referral, false))
    returning id into v_enquiry_id;
  insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
    select bm.user_id, 'enquiry:' || v_enquiry_id::text || ':' || bm.user_id::text,
      'business_enquiry', 'A customer sent a product enquiry',
      'Open your business profile workspace to review the enquiry.', 'business_enquiry', v_enquiry_id
    from public.business_memberships bm where bm.business_id = p_business_id and bm.role in ('owner', 'admin')
    on conflict (event_key) do nothing;
  return v_enquiry_id;
end;
$$;

drop policy if exists saved_suppliers_self_insert on public.saved_suppliers;
create policy saved_suppliers_self_insert on public.saved_suppliers
  for insert to authenticated with check (
    buyer_id = (select auth.uid())
    and exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.marketplace_role = 'buyer')
    and exists (select 1 from public.businesses b
      where b.id = saved_suppliers.business_id and b.verification_status = 'approved')
  );

drop policy if exists saved_suppliers_self_delete on public.saved_suppliers;
create policy saved_suppliers_self_delete on public.saved_suppliers
  for delete to authenticated using (
    buyer_id = (select auth.uid())
    and exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.marketplace_role = 'buyer')
  );

revoke all on function public.create_business_application(text, text, uuid, text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.create_sos_request(uuid, text, integer, text, text, text, text, text, text, text, text, text, timestamptz, text, text) from public, anon;
grant execute on function public.create_business_application(text, text, uuid, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_sos_request(uuid, text, integer, text, text, text, text, text, text, text, text, text, timestamptz, text, text) to authenticated;

comment on column public.profiles.marketplace_role is 'Authoritative buyer or supplier experience selected at registration.';
comment on column public.inventory.currency is 'Launch currency is USD; monetary column names remain for backward-compatible storage.';
