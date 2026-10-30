-- Support buyers who can either collect an order or receive delivery.
alter table public.profiles drop constraint if exists profiles_default_delivery_method_check;
alter table public.profiles add constraint profiles_default_delivery_method_check
  check (default_delivery_method in ('pickup', 'delivery', 'flexible', 'both'));

alter table public.sos_requests drop constraint if exists sos_requests_delivery_method_check;
alter table public.sos_requests add constraint sos_requests_delivery_method_check
  check (delivery_method in ('pickup', 'delivery', 'flexible', 'both'));

create or replace function public.create_sos_request(
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
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.marketplace_role = 'buyer') then
    raise exception 'A buyer account is required' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity not between 1 and 1000000
    or length(trim(coalesce(p_product_name, ''))) not between 2 and 180
    or length(trim(coalesce(p_city, ''))) not between 2 and 100
    or length(trim(coalesce(p_region, ''))) not between 2 and 100
    or upper(trim(coalesce(p_country, ''))) !~ '^[A-Z]{2}$'
    or p_delivery_method not in ('pickup', 'delivery', 'flexible', 'both')
    or p_urgency not in ('immediately', 'within_30_minutes', 'within_2_hours', 'today', 'scheduled')
    or coalesce(p_preferred_condition, 'any') not in ('new', 'used', 'refurbished', 'any')
    or (p_urgency = 'scheduled' and p_scheduled_at is null) then
    raise exception 'Invalid SOS request details' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories c where c.id = p_category_id and c.is_active) then
    raise exception 'Select an active product category' using errcode = '22023';
  end if;
  select greatest(1, least(168, coalesce((ps.value #>> '{}')::integer, 24))) into v_expiry_hours
    from public.platform_settings ps where ps.key = 'default_sos_expiry_hours';
  v_expiry_hours := coalesce(v_expiry_hours, 24);
  insert into public.sos_requests (requester_id, category_id, product_name, quantity, country, region, city, postal_code, area, delivery_method, urgency, specifications, preferred_condition, scheduled_at, notes, photo_path, expires_at)
  values (v_user_id, p_category_id, trim(p_product_name), p_quantity, upper(trim(p_country)), trim(p_region), trim(p_city), nullif(trim(p_postal_code), ''), nullif(trim(p_area), ''), p_delivery_method, p_urgency, nullif(trim(p_specifications), ''), coalesce(p_preferred_condition, 'any'), p_scheduled_at, nullif(trim(p_notes), ''), p_photo_path, now() + make_interval(hours => v_expiry_hours))
  returning id into v_request_id;
  for v_business_id in
    select b.id from public.businesses b
    where b.verification_status = 'approved' and b.primary_category_id = p_category_id
      and b.country = upper(trim(p_country)) and lower(trim(b.city)) = lower(trim(p_city))
      and exists (select 1 from public.products p join public.inventory i on i.product_id = p.id where p.business_id = b.id and p.category_id = p_category_id and p.is_active and p.visibility = 'public' and i.quantity_available > 0)
    order by b.created_at limit 50
  loop
    insert into public.supplier_matches (request_id, business_id, match_score, reason_codes)
      values (v_request_id, v_business_id, 100, array['category_match', 'country_match', 'city_match', 'verified_supplier', 'stock_available']) on conflict (request_id, business_id) do nothing;
    insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
    select bm.user_id, 'sos:' || v_request_id::text || ':' || bm.user_id::text, 'matching_request', 'A local SOS request matches your stock', 'Open your supplier workspace to review the request and send a quotation.', 'sos_request', v_request_id
    from public.business_memberships bm where bm.business_id = v_business_id and bm.role in ('owner', 'admin', 'fulfillment') on conflict (event_key) do nothing;
    insert into public.notification_jobs (event_key, user_id, channel, payload)
    select 'sos-email:' || v_request_id::text || ':' || bm.user_id::text, bm.user_id, 'email', jsonb_build_object('kind', 'matching_request', 'request_id', v_request_id)
    from public.business_memberships bm where bm.business_id = v_business_id and bm.role in ('owner', 'admin', 'fulfillment') on conflict (event_key) do nothing;
  end loop;
  return v_request_id;
end;
$$;
