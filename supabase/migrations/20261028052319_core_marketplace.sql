-- StockSOS core marketplace foundation.
-- Authorization is stored on profiles/business memberships, never in user metadata.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
insert into public.categories (name, slug, sort_order) values
  ('Auto parts', 'auto-parts', 10),
  ('Food and beverages', 'food-beverages', 20),
  ('Building materials', 'building-materials', 30),
  ('Electronics', 'electronics', 40),
  ('Medical supplies', 'medical-supplies', 50),
  ('Office supplies', 'office-supplies', 60),
  ('Packaging', 'packaging', 70),
  ('Agriculture', 'agriculture', 80),
  ('Fashion and retail', 'fashion-retail', 90),
  ('Other business stock', 'other', 100)
on conflict (slug) do nothing;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  home_city text,
  platform_role text not null default 'user' check (platform_role in ('user', 'support', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  primary_category_id uuid not null references public.categories(id),
  city text not null check (length(trim(city)) between 2 and 100),
  area text,
  phone text,
  email text,
  description text,
  registration_number text,
  logo_path text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected', 'suspended')),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.business_memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'inventory', 'fulfillment')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create table public.supplier_verification_files (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  object_path text not null unique,
  document_type text not null check (length(trim(document_type)) between 2 and 60),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  name text not null check (length(trim(name)) between 2 and 180),
  brand text,
  specifications text,
  condition text not null default 'new' check (condition in ('new', 'used', 'refurbished')),
  image_path text,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.inventory (
  product_id uuid primary key references public.products(id) on delete cascade,
  quantity_available integer not null default 0 check (quantity_available >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  updated_at timestamptz not null default now()
);

create table public.sos_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id),
  category_id uuid not null references public.categories(id),
  product_name text not null check (length(trim(product_name)) between 2 and 180),
  quantity integer not null check (quantity between 1 and 1000000),
  specifications text,
  preferred_condition text check (preferred_condition in ('new', 'used', 'refurbished', 'any')),
  photo_path text,
  city text not null check (length(trim(city)) between 2 and 100),
  area text,
  delivery_method text not null default 'flexible' check (delivery_method in ('pickup', 'delivery', 'flexible')),
  urgency text not null default 'today'
    check (urgency in ('immediately', 'within_30_minutes', 'within_2_hours', 'today', 'scheduled')),
  scheduled_at timestamptz,
  notes text,
  status text not null default 'open' check (status in ('open', 'accepted', 'cancelled', 'fulfilled', 'expired')),
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((urgency = 'scheduled' and scheduled_at is not null) or urgency <> 'scheduled')
);
create table public.supplier_matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.sos_requests(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  match_score smallint not null check (match_score between 0 and 100),
  reason_codes text[] not null default '{}',
  status text not null default 'matched' check (status in ('matched', 'viewed', 'quoted', 'accepted', 'dismissed', 'expired')),
  created_at timestamptz not null default now(),
  unique (request_id, business_id)
);
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.sos_requests(id) on delete cascade,
  business_id uuid not null references public.businesses(id),
  supplier_user_id uuid not null references public.profiles(id),
  product_id uuid references public.products(id),
  unit_price_kobo bigint not null check (unit_price_kobo > 0),
  quantity_offered integer not null check (quantity_offered > 0),
  delivery_fee_kobo bigint not null default 0 check (delivery_fee_kobo >= 0),
  delivery_available boolean not null default false,
  preparation_minutes integer check (preparation_minutes between 0 and 10080),
  note text,
  status text not null default 'submitted'
    check (status in ('submitted', 'accepted', 'declined', 'expired', 'withdrawn')),
  expires_at timestamptz not null default now() + interval '6 hours',
  created_at timestamptz not null default now(),
  unique (request_id, business_id)
);

-- A group can later contain multiple supplier orders; the first release creates one child order.
create table public.order_groups (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.sos_requests(id),
  buyer_id uuid not null references public.profiles(id),
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'paid', 'fulfilling', 'completed', 'cancelled', 'refunded')),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.order_groups(id),
  request_id uuid not null references public.sos_requests(id),
  quotation_id uuid not null unique references public.quotations(id),
  buyer_id uuid not null references public.profiles(id),
  business_id uuid not null references public.businesses(id),
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'paid', 'preparing', 'ready_for_pickup', 'dispatched', 'delivered', 'completed', 'cancelled', 'refunded')),
  subtotal_kobo bigint not null check (subtotal_kobo >= 0),
  delivery_fee_kobo bigint not null default 0 check (delivery_fee_kobo >= 0),
  platform_fee_kobo bigint not null default 0 check (platform_fee_kobo >= 0),
  total_kobo bigint not null check (total_kobo >= 0),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, business_id)
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_kobo bigint not null check (unit_price_kobo > 0),
  created_at timestamptz not null default now()
);
create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  order_id uuid not null unique references public.orders(id),
  quantity integer not null check (quantity > 0),
  status text not null default 'held' check (status in ('held', 'committed', 'released')),
  expires_at timestamptz not null default now() + interval '30 minutes',
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  buyer_id uuid not null references public.profiles(id),
  provider text not null default 'paystack' check (provider = 'paystack'),
  provider_reference text not null unique,
  provider_transaction_id text unique,
  amount_kobo bigint not null check (amount_kobo > 0),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  checkout_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_pending_payment_per_order on public.payments(order_id) where status = 'pending';
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  requested_by uuid not null references public.profiles(id),
  amount_kobo bigint not null check (amount_kobo > 0),
  reason text not null check (length(trim(reason)) between 3 and 1000),
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected', 'processing', 'succeeded', 'failed')),
  provider_reference text unique,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.delivery_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id),
  city text not null,
  phone text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  partner_id uuid references public.delivery_partners(id),
  delivery_city text,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled')),
  pickup_area text,
  delivery_area text,
  pickup_code_hash text,
  delivery_code_hash text,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null unique,
  kind text not null check (length(trim(kind)) between 2 and 60),
  title text not null check (length(trim(title)) between 2 and 160),
  body text not null check (length(trim(body)) between 1 and 500),
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp', 'push')),
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.subscription_plans (
  id text primary key,
  name text not null,
  monthly_price_kobo bigint not null check (monthly_price_kobo >= 0),
  benefits jsonb not null default '[]',
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.subscription_plans (id, name, monthly_price_kobo, benefits) values
  ('free', 'Free', 0, '["Business registration", "Basic inventory listings", "SOS participation", "Standard dashboard"]'::jsonb),
  ('supplier-pro', 'Supplier Pro', 750000, '["Advanced inventory management", "Enhanced analytics", "Priority business support"]'::jsonb),
  ('wholesaler-pro', 'Wholesaler Pro', 2000000, '["Bulk inventory tools", "Demand reports", "Multi-user business access"]'::jsonb)
on conflict (id) do nothing;
create table public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  plan_id text not null references public.subscription_plans(id),
  status text not null default 'active' check (status in ('active', 'past_due', 'cancelled', 'expired')),
  provider text check (provider = 'paystack'),
  provider_reference text unique,
  period_starts_at timestamptz,
  period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.saved_suppliers (
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (buyer_id, business_id)
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  buyer_id uuid not null references public.profiles(id),
  business_id uuid not null references public.businesses(id),
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 1000),
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.business_enquiries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  requester_id uuid references public.profiles(id),
  product_name text not null check (length(trim(product_name)) between 2 and 180),
  quantity integer not null check (quantity > 0),
  contact_email text,
  contact_phone text,
  consent_to_referral boolean not null default false,
  status text not null default 'new' check (status in ('new', 'sourcing', 'referred', 'closed')),
  created_at timestamptz not null default now()
);
create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  order_id uuid references public.orders(id),
  subject text not null check (length(trim(subject)) between 3 and 160),
  message text not null check (length(trim(message)) between 10 and 5000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (key, value) values
  ('marketplace_fee_bps', '0'::jsonb),
  ('default_sos_expiry_hours', '24'::jsonb)
on conflict (key) do nothing;

create index businesses_category_city_status_idx on public.businesses(primary_category_id, lower(city), verification_status);
create index products_category_active_idx on public.products(category_id, is_active, visibility);
create index products_business_created_idx on public.products(business_id, created_at desc);
create index sos_requests_requester_created_idx on public.sos_requests(requester_id, created_at desc);
create index sos_requests_status_created_idx on public.sos_requests(status, created_at desc);
create index supplier_matches_business_status_idx on public.supplier_matches(business_id, status, created_at desc);
create index quotations_request_status_idx on public.quotations(request_id, status, expires_at);
create index orders_buyer_created_idx on public.orders(buyer_id, created_at desc);
create index orders_business_status_idx on public.orders(business_id, status, created_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
create index notification_jobs_queue_idx on public.notification_jobs(status, run_after) where status in ('queued', 'failed');

create function private.is_business_member(p_business_id uuid, p_roles text[] default null)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.business_memberships bm
    where bm.business_id = p_business_id and bm.user_id = auth.uid()
      and (p_roles is null or bm.role = any(p_roles))
  );
$$;
create function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'admin'
  );
$$;
create function private.is_assigned_delivery_partner(p_order_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.deliveries d join public.delivery_partners dp on dp.id = d.partner_id
    where d.order_id = p_order_id and dp.user_id = auth.uid()
  );
$$;
create function private.safe_uuid(p_value text)
returns uuid language plpgsql immutable set search_path = ''
as $$
begin
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;
create function private.business_member_for_object(p_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_business_member(private.safe_uuid(split_part(p_name, '/', 1)));
$$;
revoke all on function private.is_business_member(uuid, text[]) from public, anon;
revoke all on function private.is_admin() from public, anon;
revoke all on function private.is_assigned_delivery_partner(uuid) from public, anon;
revoke all on function private.safe_uuid(text) from public, anon, authenticated;
revoke all on function private.business_member_for_object(text) from public, anon;
grant execute on function private.is_business_member(uuid, text[]) to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.is_assigned_delivery_partner(uuid) to authenticated, service_role;
grant execute on function private.business_member_for_object(text) to authenticated, service_role;
create function private.is_support_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.platform_role in ('support', 'admin')
  );
$$;
revoke all on function private.is_support_staff() from public, anon;
grant execute on function private.is_support_staff() to authenticated, service_role;

create function public.create_business_application(
  p_name text, p_slug text, p_category_id uuid, p_city text,
  p_area text default null, p_phone text default null, p_email text default null,
  p_description text default null, p_registration_number text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_business_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 120
    or length(trim(coalesce(p_city, ''))) not between 2 and 100
    or coalesce(p_slug, '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Invalid business details' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories c where c.id = p_category_id and c.is_active) then
    raise exception 'Select an active business category' using errcode = '22023';
  end if;
  insert into public.businesses (
    name, slug, primary_category_id, city, area, phone, email, description, registration_number, created_by
  ) values (
    trim(p_name), lower(trim(p_slug)), p_category_id, trim(p_city), nullif(trim(p_area), ''),
    nullif(trim(p_phone), ''), nullif(lower(trim(p_email)), ''), nullif(trim(p_description), ''),
    nullif(trim(p_registration_number), ''), v_user_id
  ) returning id into v_business_id;
  insert into public.business_memberships (business_id, user_id, role)
    values (v_business_id, v_user_id, 'owner');
  insert into public.audit_logs (actor_id, action, target_type, target_id)
    values (v_user_id, 'business_application_created', 'business', v_business_id);
  return v_business_id;
end;
$$;

create function public.create_sos_request(
  p_category_id uuid, p_product_name text, p_quantity integer, p_city text, p_area text,
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
  if p_quantity is null or p_quantity not between 1 and 1000000
    or length(trim(coalesce(p_product_name, ''))) not between 2 and 180
    or length(trim(coalesce(p_city, ''))) not between 2 and 100
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
    requester_id, category_id, product_name, quantity, city, area, delivery_method, urgency,
    specifications, preferred_condition, scheduled_at, notes, photo_path, expires_at
  ) values (
    v_user_id, p_category_id, trim(p_product_name), p_quantity, trim(p_city), nullif(trim(p_area), ''),
    p_delivery_method, p_urgency, nullif(trim(p_specifications), ''), coalesce(p_preferred_condition, 'any'),
    p_scheduled_at, nullif(trim(p_notes), ''), p_photo_path, now() + make_interval(hours => v_expiry_hours)
  ) returning id into v_request_id;
  for v_business_id in
    select b.id
    from public.businesses b
    where b.verification_status = 'approved'
      and b.primary_category_id = p_category_id
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
      values (v_request_id, v_business_id, 100, array['category_match', 'city_match', 'verified_supplier', 'stock_available'])
      on conflict (request_id, business_id) do nothing;
    insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
    select bm.user_id, 'sos:' || v_request_id::text || ':' || bm.user_id::text,
      'matching_request', 'A nearby SOS request matches your stock',
      'Open your supplier workspace to review the request and send a quotation.', 'sos_request', v_request_id
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

create function public.cancel_sos_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.sos_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_request from public.sos_requests where id = p_request_id for update;
  if not found or v_request.requester_id <> auth.uid() then
    raise exception 'Request not found' using errcode = '42501';
  end if;
  if v_request.status <> 'open' then
    raise exception 'This request can no longer be cancelled' using errcode = '22023';
  end if;
  update public.sos_requests set status = 'cancelled', updated_at = now() where id = p_request_id;
  update public.supplier_matches set status = 'expired' where request_id = p_request_id and status <> 'dismissed';
  update public.quotations set status = 'expired' where request_id = p_request_id and status = 'submitted';
end;
$$;

create function public.submit_quotation(
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
    quantity_offered, delivery_fee_kobo, delivery_available, preparation_minutes, note
  ) values (
    p_request_id, p_business_id, auth.uid(), p_product_id, p_unit_price_kobo,
    p_quantity_offered, p_delivery_fee_kobo, p_delivery_available, p_preparation_minutes,
    nullif(trim(p_note), '')
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

create function public.accept_quotation(p_quotation_id uuid)
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
  v_delivery_fee := case when v_request.delivery_method <> 'pickup' and v_quote.delivery_available then v_quote.delivery_fee_kobo else 0 end;
  select coalesce((ps.value #>> '{}')::integer, 0) into v_fee_bps
    from public.platform_settings ps where ps.key = 'marketplace_fee_bps';
  v_fee := ceil(v_subtotal::numeric * coalesce(v_fee_bps, 0) / 10000)::bigint;
  insert into public.order_groups (request_id, buyer_id) values (v_request.id, auth.uid()) returning id into v_group_id;
  insert into public.orders (
    group_id, request_id, quotation_id, buyer_id, business_id,
    subtotal_kobo, delivery_fee_kobo, platform_fee_kobo, total_kobo
  ) values (
    v_group_id, v_request.id, v_quote.id, auth.uid(), v_quote.business_id,
    v_subtotal, v_delivery_fee, v_fee, v_subtotal + v_delivery_fee + v_fee
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
      'Your order is ready for payment', 'Review the order details to continue checkout.', 'order', v_order_id),
    (v_quote.supplier_user_id, 'order:' || v_order_id::text || ':created:supplier', 'order_created',
      'A buyer accepted your quotation', 'Open your supplier workspace to view the order.', 'order', v_order_id)
  on conflict (event_key) do nothing;
  return v_order_id;
end;
$$;

create function public.confirm_paystack_payment(p_reference text, p_transaction_id text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  if (auth.jwt() ->> 'role') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select * into v_payment from public.payments where provider_reference = p_reference for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  if v_payment.provider_transaction_id is not null and v_payment.provider_transaction_id <> p_transaction_id then
    raise exception 'Payment transaction reference mismatch' using errcode = '22023';
  end if;
  if v_payment.status = 'succeeded' then return v_payment.order_id; end if;
  if v_payment.status <> 'pending' then raise exception 'Payment is not pending' using errcode = '22023'; end if;
  update public.payments set status = 'succeeded', provider_transaction_id = p_transaction_id,
    verified_at = now(), updated_at = now() where id = v_payment.id;
  update public.orders set status = 'paid', paid_at = now(), updated_at = now()
    where id = v_payment.order_id and status = 'awaiting_payment' and total_kobo = v_payment.amount_kobo;
  if not found then raise exception 'Order amount or state does not match payment' using errcode = '22023'; end if;
  update public.order_groups set status = 'paid', updated_at = now()
    where id = (select o.group_id from public.orders o where o.id = v_payment.order_id);
  update public.stock_reservations set status = 'committed'
    where order_id = v_payment.order_id and status = 'held';
  update public.inventory i set quantity_reserved = i.quantity_reserved - r.quantity, updated_at = now()
    from public.stock_reservations r
    where r.order_id = v_payment.order_id and r.product_id = i.product_id and r.status = 'committed';
  insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
  select o.buyer_id, 'payment:' || v_payment.id::text || ':succeeded', 'payment_succeeded',
    'Payment confirmed', 'Your payment was verified and the supplier can prepare your order.', 'order', o.id
  from public.orders o where o.id = v_payment.order_id
  on conflict (event_key) do nothing;
  return v_payment.order_id;
end;
$$;

create function public.create_supplier_product(
  p_business_id uuid, p_category_id uuid, p_name text, p_brand text,
  p_specifications text, p_condition text, p_quantity integer,
  p_unit_price_kobo bigint, p_visibility text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_product_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not private.is_business_member(p_business_id, array['owner', 'admin', 'inventory'])
    or not exists (select 1 from public.businesses b where b.id = p_business_id and b.verification_status = 'approved') then
    raise exception 'Approved supplier access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.categories c where c.id = p_category_id and c.is_active)
    or length(trim(coalesce(p_name, ''))) not between 2 and 180
    or p_condition not in ('new', 'used', 'refurbished')
    or p_quantity is null or p_quantity < 0
    or p_unit_price_kobo is null or p_unit_price_kobo < 0
    or p_visibility not in ('public', 'private') then
    raise exception 'Invalid product details' using errcode = '22023';
  end if;
  insert into public.products (
    business_id, category_id, name, brand, specifications, condition, visibility, created_by
  ) values (
    p_business_id, p_category_id, trim(p_name), nullif(trim(p_brand), ''),
    nullif(trim(p_specifications), ''), p_condition, p_visibility, auth.uid()
  ) returning id into v_product_id;
  insert into public.inventory (product_id, quantity_available, unit_price_kobo)
    values (v_product_id, p_quantity, p_unit_price_kobo);
  return v_product_id;
end;
$$;

create function public.update_supplier_product(
  p_product_id uuid, p_name text, p_brand text, p_specifications text,
  p_condition text, p_quantity_available integer, p_unit_price_kobo bigint,
  p_visibility text, p_is_active boolean
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select p.business_id into v_business_id from public.products p where p.id = p_product_id for update;
  if not found or not private.is_business_member(v_business_id, array['owner', 'admin', 'inventory'])
    or not exists (select 1 from public.businesses b where b.id = v_business_id and b.verification_status = 'approved') then
    raise exception 'Approved supplier access required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 180
    or p_condition not in ('new', 'used', 'refurbished')
    or p_quantity_available is null or p_quantity_available < 0
    or p_unit_price_kobo is null or p_unit_price_kobo < 0
    or p_visibility not in ('public', 'private') or p_is_active is null then
    raise exception 'Invalid product details' using errcode = '22023';
  end if;
  update public.products set name = trim(p_name), brand = nullif(trim(p_brand), ''),
    specifications = nullif(trim(p_specifications), ''), condition = p_condition,
    visibility = p_visibility, is_active = p_is_active, updated_at = now()
    where id = p_product_id;
  update public.inventory set quantity_available = p_quantity_available,
    unit_price_kobo = p_unit_price_kobo, updated_at = now() where product_id = p_product_id;
end;
$$;

create function public.admin_review_business(
  p_business_id uuid, p_status text, p_note text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_status not in ('approved', 'rejected', 'suspended') then
    raise exception 'Invalid review status' using errcode = '22023';
  end if;
  update public.businesses set verification_status = p_status, updated_at = now()
    where id = p_business_id returning created_by into v_owner;
  if not found then raise exception 'Business not found' using errcode = 'P0002'; end if;
  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'business_verification_' || p_status, 'business', p_business_id,
      jsonb_build_object('note', left(coalesce(p_note, ''), 500)));
  insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
    values (v_owner, 'business:' || p_business_id::text || ':review:' || p_status || ':' || now()::date::text,
      'business_verification', 'Business application updated',
      case p_status when 'approved' then 'Your business is approved to participate in the marketplace.'
        when 'rejected' then 'Your business application needs changes before it can participate.'
        else 'Your business marketplace access has been suspended.' end,
      'business', p_business_id)
    on conflict (event_key) do nothing;
end;
$$;

create function public.apply_delivery_partner(p_city text, p_phone text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_partner_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_city, ''))) not between 2 and 100 then
    raise exception 'Enter a valid city' using errcode = '22023';
  end if;
  insert into public.delivery_partners (user_id, city, phone)
    values (auth.uid(), trim(p_city), nullif(trim(p_phone), ''))
    on conflict (user_id) do update set city = excluded.city, phone = excluded.phone
    returning id into v_partner_id;
  return v_partner_id;
end;
$$;

create function public.admin_review_delivery_partner(p_partner_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_status not in ('approved', 'rejected', 'suspended') then
    raise exception 'Invalid review status' using errcode = '22023';
  end if;
  update public.delivery_partners set verification_status = p_status, updated_at = now()
    where id = p_partner_id;
  if not found then raise exception 'Delivery partner not found' using errcode = 'P0002'; end if;
  insert into public.audit_logs (actor_id, action, target_type, target_id)
    values (auth.uid(), 'delivery_partner_' || p_status, 'delivery_partner', p_partner_id);
end;
$$;

create function public.admin_update_subscription_plan(
  p_plan_id text, p_monthly_price_kobo bigint, p_benefits jsonb, p_is_active boolean
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_monthly_price_kobo < 0 or jsonb_typeof(p_benefits) <> 'array' then
    raise exception 'Invalid plan configuration' using errcode = '22023';
  end if;
  update public.subscription_plans set monthly_price_kobo = p_monthly_price_kobo,
    benefits = p_benefits, is_active = p_is_active, updated_at = now()
    where id = p_plan_id;
  if not found then raise exception 'Subscription plan not found' using errcode = 'P0002'; end if;
  insert into public.audit_logs (actor_id, action, target_type, details)
    values (auth.uid(), 'subscription_plan_updated', 'subscription_plan',
      jsonb_build_object('plan_id', p_plan_id, 'monthly_price_kobo', p_monthly_price_kobo));
end;
$$;

create function public.admin_update_marketplace_fee(p_fee_bps integer)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_fee_bps not between 0 and 2000 then raise exception 'Fee must be between 0 and 20 percent' using errcode = '22023'; end if;
  update public.platform_settings set value = to_jsonb(p_fee_bps), updated_by = auth.uid(), updated_at = now()
    where key = 'marketplace_fee_bps';
  if not found then
    insert into public.platform_settings (key, value, updated_by)
      values ('marketplace_fee_bps', to_jsonb(p_fee_bps), auth.uid());
  end if;
  insert into public.audit_logs (actor_id, action, target_type, details)
    values (auth.uid(), 'marketplace_fee_updated', 'platform_setting', jsonb_build_object('fee_bps', p_fee_bps));
end;
$$;

create function public.update_supplier_order_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_delivery_method text;
  v_area text;
  v_city text;
  v_delivery_available boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not private.is_business_member(v_order.business_id, array['owner', 'admin', 'fulfillment']) then
    raise exception 'Order not found' using errcode = '42501';
  end if;
  if (v_order.status = 'paid' and p_status = 'preparing')
    or (v_order.status = 'preparing' and p_status = 'ready_for_pickup') then
    update public.orders set status = p_status, updated_at = now() where id = p_order_id;
    if p_status = 'ready_for_pickup' then
      select r.delivery_method, r.area, r.city, q.delivery_available
        into v_delivery_method, v_area, v_city, v_delivery_available
        from public.sos_requests r join public.quotations q on q.id = v_order.quotation_id
        where r.id = v_order.request_id;
      if v_delivery_method <> 'pickup' and v_delivery_available then
        insert into public.deliveries (order_id, status, delivery_city, pickup_area, delivery_area)
          select v_order.id, 'requested', v_city, b.area, v_area
          from public.businesses b where b.id = v_order.business_id
          on conflict (order_id) do nothing;
      end if;
    end if;
    insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
      values (v_order.buyer_id, 'order:' || p_order_id::text || ':' || p_status,
        'order_status', 'Order status updated', 'Your supplier updated the order status.', 'order', p_order_id)
      on conflict (event_key) do nothing;
  else
    raise exception 'That order status transition is not allowed' using errcode = '22023';
  end if;
end;
$$;

create function public.accept_delivery_job(p_delivery_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_partner public.delivery_partners%rowtype;
  v_job public.deliveries%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_partner from public.delivery_partners
    where user_id = auth.uid() and verification_status = 'approved' for update;
  if not found then raise exception 'Approved delivery partner access required' using errcode = '42501'; end if;
  select * into v_job from public.deliveries where id = p_delivery_id for update;
  if not found or v_job.status <> 'requested' or lower(coalesce(v_job.delivery_city, '')) <> lower(v_partner.city) then
    raise exception 'Delivery job is no longer available in your city' using errcode = '22023';
  end if;
  update public.deliveries set partner_id = v_partner.id, status = 'accepted', updated_at = now()
    where id = p_delivery_id;
end;
$$;

create function public.update_delivery_job_status(p_delivery_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_job public.deliveries%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select d.* into v_job from public.deliveries d
    join public.delivery_partners dp on dp.id = d.partner_id
    where d.id = p_delivery_id and dp.user_id = auth.uid() and dp.verification_status = 'approved'
    for update of d;
  if not found then raise exception 'Delivery job not found' using errcode = '42501'; end if;
  if (v_job.status = 'accepted' and p_status = 'picked_up')
    or (v_job.status = 'picked_up' and p_status = 'in_transit') then
    update public.deliveries set status = p_status, picked_up_at = case when p_status = 'picked_up' then now() else picked_up_at end,
      updated_at = now() where id = p_delivery_id;
  elsif v_job.status = 'in_transit' and p_status = 'delivered' then
    update public.deliveries set status = 'delivered', delivered_at = now(), updated_at = now() where id = p_delivery_id;
    update public.orders set status = 'delivered', updated_at = now() where id = v_job.order_id and status = 'ready_for_pickup';
    insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
      select o.buyer_id, 'delivery:' || p_delivery_id::text || ':delivered', 'delivery_completed',
        'Delivery marked complete', 'Confirm receipt in your order when the items arrive.', 'order', o.id
      from public.orders o where o.id = v_job.order_id
      on conflict (event_key) do nothing;
  else
    raise exception 'That delivery status transition is not allowed' using errcode = '22023';
  end if;
end;
$$;

create function public.buyer_confirm_receipt(p_order_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_order from public.orders where id = p_order_id and buyer_id = auth.uid() for update;
  if not found then raise exception 'Order not found' using errcode = '42501'; end if;
  if v_order.status not in ('ready_for_pickup', 'delivered') then
    raise exception 'The order is not ready to be completed' using errcode = '22023';
  end if;
  update public.orders set status = 'completed', updated_at = now() where id = p_order_id;
  update public.order_groups set status = 'completed', updated_at = now() where id = v_order.group_id;
end;
$$;

create function public.create_business_enquiry(
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

create function public.update_business_enquiry_status(p_enquiry_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_enquiry public.business_enquiries%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_status not in ('sourcing', 'referred', 'closed') then
    raise exception 'Invalid enquiry status' using errcode = '22023';
  end if;
  select * into v_enquiry from public.business_enquiries where id = p_enquiry_id for update;
  if not found or not private.is_business_member(v_enquiry.business_id, array['owner', 'admin']) then
    raise exception 'Enquiry not found' using errcode = '42501';
  end if;
  if p_status = 'referred' and not v_enquiry.consent_to_referral then
    raise exception 'Customer consent is required before referral' using errcode = '42501';
  end if;
  update public.business_enquiries set status = p_status where id = p_enquiry_id;
  insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
  values (v_enquiry.requester_id, 'enquiry:' || p_enquiry_id::text || ':status:' || p_status,
    'business_enquiry_status', 'Your product enquiry was updated',
    'The business updated the status of your product enquiry.', 'business_enquiry', p_enquiry_id)
  on conflict (event_key) do nothing;
end;
$$;

create function public.update_support_case_status(p_case_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_support_staff() then raise exception 'Support staff access required' using errcode = '42501'; end if;
  if p_status not in ('open', 'in_progress', 'resolved', 'closed') then
    raise exception 'Invalid support case status' using errcode = '22023';
  end if;
  update public.support_cases set status = p_status, updated_at = now()
    where id = p_case_id;
  if not found then raise exception 'Support case not found' using errcode = 'P0002'; end if;
  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'support_case_status_updated', 'support_case', p_case_id,
      jsonb_build_object('status', p_status));
end;
$$;

create function public.get_marketplace_fee_bps()
returns integer language sql stable security definer set search_path = ''
as $$
  select coalesce((ps.value #>> '{}')::integer, 0)
  from public.platform_settings ps where ps.key = 'marketplace_fee_bps';
$$;

create function public.admin_pending_businesses()
returns table (
  id uuid, name text, slug text, city text, area text, phone text,
  email text, registration_number text, created_at timestamptz, category_name text
)
language sql stable security definer set search_path = ''
as $$
  select b.id, b.name, b.slug, b.city, b.area, b.phone, b.email,
    b.registration_number, b.created_at, c.name
  from public.businesses b join public.categories c on c.id = b.primary_category_id
  where private.is_admin() and b.verification_status = 'pending'
  order by b.created_at limit 30;
$$;

create function private.release_held_stock_for_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.inventory i set
    quantity_available = i.quantity_available + r.quantity,
    quantity_reserved = i.quantity_reserved - r.quantity,
    updated_at = now()
  from public.stock_reservations r
  where r.order_id = p_order_id and r.product_id = i.product_id and r.status = 'held';
  update public.stock_reservations set status = 'released'
    where order_id = p_order_id and status = 'held';
end;
$$;
revoke all on function private.release_held_stock_for_order(uuid) from public, anon, authenticated;

create function public.fail_paystack_payment(p_reference text, p_provider_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  if (auth.jwt() ->> 'role') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_provider_status not in ('failed', 'abandoned') then
    raise exception 'Provider status is not conclusive' using errcode = '22023';
  end if;
  select * into v_payment from public.payments where provider_reference = p_reference for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  if v_payment.status = 'succeeded' or v_payment.status = 'failed' then return; end if;
  if v_payment.status <> 'pending' then raise exception 'Payment is not pending' using errcode = '22023'; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  update public.payments set status = 'failed', updated_at = now() where id = v_payment.id;
  if v_order.status = 'awaiting_payment' then
    update public.orders set status = 'cancelled', updated_at = now() where id = v_order.id;
    update public.order_groups set status = 'cancelled', updated_at = now() where id = v_order.group_id;
    perform private.release_held_stock_for_order(v_order.id);
    update public.sos_requests set status = 'expired', updated_at = now() where id = v_order.request_id;
    update public.quotations set status = 'expired' where request_id = v_order.request_id and status in ('submitted', 'accepted');
    update public.supplier_matches set status = 'expired' where request_id = v_order.request_id and status <> 'dismissed';
    insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
      values (v_order.buyer_id, 'payment:' || v_payment.id::text || ':failed', 'payment_failed',
        'Payment was not completed', 'The payment attempt was not completed and the stock hold was released. Create a new SOS request to try again.', 'order', v_order.id)
      on conflict (event_key) do nothing;
  end if;
end;
$$;

create function public.expire_unpaid_orders(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_count integer := 0;
begin
  if (auth.jwt() ->> 'role') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  for v_order in
    select o.* from public.orders o
    where o.status = 'awaiting_payment' and o.created_at <= now() - interval '30 minutes'
      and not exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'pending'
        and (p.checkout_url is not null or p.created_at > now() - interval '5 minutes'))
    order by o.created_at
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update of o skip locked
  loop
    update public.payments set status = 'failed', updated_at = now()
      where order_id = v_order.id and status = 'pending' and checkout_url is null;
    update public.orders set status = 'cancelled', updated_at = now() where id = v_order.id;
    update public.order_groups set status = 'cancelled', updated_at = now() where id = v_order.group_id;
    perform private.release_held_stock_for_order(v_order.id);
    update public.sos_requests set status = 'expired', updated_at = now() where id = v_order.request_id;
    update public.quotations set status = 'expired' where request_id = v_order.request_id and status in ('submitted', 'accepted');
    update public.supplier_matches set status = 'expired' where request_id = v_order.request_id and status <> 'dismissed';
    insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
      values (v_order.buyer_id, 'order:' || v_order.id::text || ':expired', 'payment_expired',
        'Unpaid order expired', 'The order and stock hold expired. Create a new SOS request to continue.', 'order', v_order.id)
      on conflict (event_key) do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.create_business_application(text, text, uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.create_sos_request(uuid, text, integer, text, text, text, text, text, text, timestamptz, text, text) from public, anon;
revoke all on function public.cancel_sos_request(uuid) from public, anon;
revoke all on function public.submit_quotation(uuid, uuid, uuid, bigint, integer, bigint, boolean, integer, text) from public, anon;
revoke all on function public.accept_quotation(uuid) from public, anon;
revoke all on function public.confirm_paystack_payment(text, text) from public, anon, authenticated;
revoke all on function public.create_supplier_product(uuid, uuid, text, text, text, text, integer, bigint, text) from public, anon;
revoke all on function public.update_supplier_product(uuid, text, text, text, text, integer, bigint, text, boolean) from public, anon;
revoke all on function public.admin_review_business(uuid, text, text) from public, anon;
revoke all on function public.apply_delivery_partner(text, text) from public, anon;
revoke all on function public.admin_review_delivery_partner(uuid, text) from public, anon;
revoke all on function public.admin_update_subscription_plan(text, bigint, jsonb, boolean) from public, anon;
revoke all on function public.admin_update_marketplace_fee(integer) from public, anon;
revoke all on function public.update_supplier_order_status(uuid, text) from public, anon;
revoke all on function public.accept_delivery_job(uuid) from public, anon;
revoke all on function public.update_delivery_job_status(uuid, text) from public, anon;
revoke all on function public.buyer_confirm_receipt(uuid) from public, anon;
revoke all on function public.create_business_enquiry(uuid, text, integer, boolean) from public, anon;
revoke all on function public.update_business_enquiry_status(uuid, text) from public, anon;
revoke all on function public.update_support_case_status(uuid, text) from public, anon;
revoke all on function public.get_marketplace_fee_bps() from public;
revoke all on function public.admin_pending_businesses() from public, anon;
revoke all on function public.fail_paystack_payment(text, text) from public, anon, authenticated;
revoke all on function public.expire_unpaid_orders(integer) from public, anon, authenticated;
grant execute on function public.create_business_application(text, text, uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_sos_request(uuid, text, integer, text, text, text, text, text, text, timestamptz, text, text) to authenticated;
grant execute on function public.cancel_sos_request(uuid) to authenticated;
grant execute on function public.submit_quotation(uuid, uuid, uuid, bigint, integer, bigint, boolean, integer, text) to authenticated;
grant execute on function public.accept_quotation(uuid) to authenticated;
grant execute on function public.confirm_paystack_payment(text, text) to service_role;
grant execute on function public.create_supplier_product(uuid, uuid, text, text, text, text, integer, bigint, text) to authenticated;
grant execute on function public.update_supplier_product(uuid, text, text, text, text, integer, bigint, text, boolean) to authenticated;
grant execute on function public.admin_review_business(uuid, text, text) to authenticated;
grant execute on function public.apply_delivery_partner(text, text) to authenticated;
grant execute on function public.admin_review_delivery_partner(uuid, text) to authenticated;
grant execute on function public.admin_update_subscription_plan(text, bigint, jsonb, boolean) to authenticated;
grant execute on function public.admin_update_marketplace_fee(integer) to authenticated;
grant execute on function public.update_supplier_order_status(uuid, text) to authenticated;
grant execute on function public.accept_delivery_job(uuid) to authenticated;
grant execute on function public.update_delivery_job_status(uuid, text) to authenticated;
grant execute on function public.buyer_confirm_receipt(uuid) to authenticated;
grant execute on function public.create_business_enquiry(uuid, text, integer, boolean) to authenticated;
grant execute on function public.update_business_enquiry_status(uuid, text) to authenticated;
grant execute on function public.update_support_case_status(uuid, text) to authenticated;
grant execute on function public.get_marketplace_fee_bps() to anon, authenticated;
grant execute on function public.admin_pending_businesses() to authenticated;
grant execute on function public.fail_paystack_payment(text, text) to service_role;
grant execute on function public.expire_unpaid_orders(integer) to service_role;

alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table public.supplier_verification_files enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.sos_requests enable row level security;
alter table public.supplier_matches enable row level security;
alter table public.quotations enable row level security;
alter table public.order_groups enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.delivery_partners enable row level security;
alter table public.deliveries enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.business_subscriptions enable row level security;
alter table public.saved_suppliers enable row level security;
alter table public.reviews enable row level security;
alter table public.business_enquiries enable row level security;
alter table public.support_cases enable row level security;
alter table public.audit_logs enable row level security;
alter table public.platform_settings enable row level security;

-- Explicit grants keep tables available through the Data API as Supabase tightens defaults.
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.subscription_plans to anon, authenticated;
revoke select on public.reviews from anon, authenticated;
grant select (id, business_id, rating, comment, is_visible, created_at) on public.reviews to anon, authenticated;
revoke select on public.businesses, public.products, public.inventory from anon, authenticated;
grant select (id, name, slug, primary_category_id, city, area, description, verification_status, visibility, created_at, updated_at)
  on public.businesses to anon, authenticated;
grant select (id, business_id, category_id, name, brand, specifications, condition, image_path, visibility, is_active, created_at, updated_at)
  on public.products to anon, authenticated;
grant select (product_id, quantity_available, unit_price_kobo, currency, updated_at)
  on public.inventory to anon, authenticated;
grant select on public.profiles, public.business_memberships, public.supplier_verification_files,
  public.sos_requests, public.supplier_matches, public.quotations, public.order_groups, public.orders,
  public.order_items, public.stock_reservations, public.payments, public.refunds, public.delivery_partners,
  public.deliveries, public.notifications, public.business_subscriptions, public.saved_suppliers,
  public.business_enquiries, public.support_cases, public.audit_logs, public.platform_settings to authenticated;
grant update (full_name, phone, home_city, updated_at) on public.profiles to authenticated;
grant update (category_id, name, brand, specifications, condition, image_path, visibility, is_active, updated_at)
  on public.products to authenticated;
grant delete on public.products to authenticated;
grant insert (product_id, quantity_available, unit_price_kobo, currency, updated_at) on public.inventory to authenticated;
grant update (quantity_available, unit_price_kobo, updated_at) on public.inventory to authenticated;
grant insert (buyer_id, business_id) on public.saved_suppliers to authenticated;
grant delete on public.saved_suppliers to authenticated;
grant insert (order_id, buyer_id, business_id, rating, comment) on public.reviews to authenticated;
grant insert (user_id, subject, message, order_id) on public.support_cases to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on all tables in schema public to service_role;

create policy categories_active_read on public.categories
  for select to anon, authenticated using (is_active);
create policy profiles_read_self_or_admin on public.profiles
  for select to authenticated using (id = (select auth.uid()) or private.is_admin());
create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated using (id = (select auth.uid()) or private.is_admin())
  with check (id = (select auth.uid()) or private.is_admin());

create policy businesses_public_read on public.businesses
  for select to anon using (verification_status = 'approved' and visibility = 'public');
create policy businesses_member_read on public.businesses
  for select to authenticated using (
    (verification_status = 'approved' and visibility = 'public')
    or private.is_business_member(id) or private.is_admin()
  );
create policy memberships_self_or_admin_read on public.business_memberships
  for select to authenticated using (user_id = (select auth.uid()) or private.is_admin());
create policy verification_files_member_read on public.supplier_verification_files
  for select to authenticated using (private.is_business_member(business_id) or private.is_admin());

create policy products_public_read on public.products
  for select to anon using (
    is_active and visibility = 'public' and exists (
      select 1 from public.businesses b where b.id = business_id
        and b.verification_status = 'approved' and b.visibility = 'public'
    )
  );
create policy products_member_read on public.products
  for select to authenticated using (
    (is_active and visibility = 'public' and exists (
      select 1 from public.businesses b where b.id = business_id
        and b.verification_status = 'approved' and b.visibility = 'public'
    )) or private.is_business_member(business_id) or private.is_admin()
  );
create policy products_member_insert on public.products for insert to authenticated with check (
  created_by = (select auth.uid()) and private.is_business_member(business_id, array['owner', 'admin', 'inventory'])
);
create policy products_member_update on public.products for update to authenticated
  using (private.is_business_member(business_id, array['owner', 'admin', 'inventory']))
  with check (private.is_business_member(business_id, array['owner', 'admin', 'inventory']));
create policy products_member_delete on public.products for delete to authenticated
  using (private.is_business_member(business_id, array['owner', 'admin']));

create policy inventory_public_read on public.inventory
  for select to anon using (exists (
    select 1 from public.products p join public.businesses b on b.id = p.business_id
    where p.id = product_id and p.is_active and p.visibility = 'public'
      and b.verification_status = 'approved' and b.visibility = 'public'
  ));
create policy inventory_member_read on public.inventory
  for select to authenticated using (
    exists (select 1 from public.products p join public.businesses b on b.id = p.business_id
      where p.id = product_id and p.is_active and p.visibility = 'public'
        and b.verification_status = 'approved' and b.visibility = 'public')
    or private.is_business_member((select p.business_id from public.products p where p.id = inventory.product_id))
    or private.is_admin()
  );
create policy inventory_member_insert on public.inventory for insert to authenticated with check (
  private.is_business_member((select p.business_id from public.products p where p.id = inventory.product_id), array['owner', 'admin', 'inventory'])
);
create policy inventory_member_update on public.inventory for update to authenticated
  using (private.is_business_member((select p.business_id from public.products p where p.id = inventory.product_id), array['owner', 'admin', 'inventory']))
  with check (private.is_business_member((select p.business_id from public.products p where p.id = inventory.product_id), array['owner', 'admin', 'inventory']));

create policy sos_request_parties_read on public.sos_requests
  for select to authenticated using (
    requester_id = (select auth.uid()) or private.is_admin()
    or exists (select 1 from public.supplier_matches sm
      where sm.request_id = sos_requests.id and private.is_business_member(sm.business_id))
  );
create policy supplier_matches_parties_read on public.supplier_matches
  for select to authenticated using (
    private.is_admin() or private.is_business_member(business_id)
    or exists (select 1 from public.sos_requests r where r.id = request_id and r.requester_id = (select auth.uid()))
  );
create policy quotations_parties_read on public.quotations
  for select to authenticated using (
    private.is_admin() or private.is_business_member(business_id)
    or exists (select 1 from public.sos_requests r where r.id = request_id and r.requester_id = (select auth.uid()))
  );

create policy order_groups_parties_read on public.order_groups
  for select to authenticated using (
    buyer_id = (select auth.uid()) or private.is_admin()
    or exists (select 1 from public.orders o where o.group_id = order_groups.id and private.is_business_member(o.business_id))
  );
create policy orders_parties_read on public.orders
  for select to authenticated using (
    buyer_id = (select auth.uid()) or private.is_business_member(business_id) or private.is_admin()
    or private.is_assigned_delivery_partner(id)
  );
create policy order_items_parties_read on public.order_items
  for select to authenticated using (exists (
    select 1 from public.orders o where o.id = order_id and (
      o.buyer_id = (select auth.uid()) or private.is_business_member(o.business_id) or private.is_admin()
      or exists (select 1 from public.deliveries d join public.delivery_partners dp on dp.id = d.partner_id
        where d.order_id = o.id and dp.user_id = (select auth.uid()))
    )
  ));
create policy stock_reservations_parties_read on public.stock_reservations
  for select to authenticated using (exists (
    select 1 from public.orders o where o.id = order_id and (
      o.buyer_id = (select auth.uid()) or private.is_business_member(o.business_id) or private.is_admin()
    )
  ));

create policy payments_buyer_read on public.payments
  for select to authenticated using (buyer_id = (select auth.uid()) or private.is_admin());
create policy refunds_requester_read on public.refunds
  for select to authenticated using (requested_by = (select auth.uid()) or private.is_admin());
create policy delivery_partner_self_read on public.delivery_partners
  for select to authenticated using (user_id = (select auth.uid()) or private.is_admin());
create policy deliveries_parties_read on public.deliveries
  for select to authenticated using (
    private.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and (
      o.buyer_id = (select auth.uid()) or private.is_business_member(o.business_id)
    ))
    or exists (select 1 from public.delivery_partners dp where dp.id = partner_id and dp.user_id = (select auth.uid()))
  );
create policy deliveries_available_jobs_read on public.deliveries
  for select to authenticated using (
    status = 'requested' and exists (
      select 1 from public.delivery_partners dp where dp.user_id = (select auth.uid())
        and dp.verification_status = 'approved' and lower(dp.city) = lower(deliveries.delivery_city)
    )
  );
create policy notifications_self_read on public.notifications
  for select to authenticated using (user_id = (select auth.uid()) or private.is_admin());
create policy notifications_self_mark_read on public.notifications
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy plans_public_read on public.subscription_plans
  for select to anon using (is_active);
create policy plans_authenticated_read on public.subscription_plans
  for select to authenticated using (is_active or private.is_admin());
create policy business_subscriptions_member_read on public.business_subscriptions
  for select to authenticated using (private.is_business_member(business_id) or private.is_admin());
create policy saved_suppliers_self_read on public.saved_suppliers
  for select to authenticated using (buyer_id = (select auth.uid()));
create policy saved_suppliers_self_insert on public.saved_suppliers
  for insert to authenticated with check (
    buyer_id = (select auth.uid()) and exists (select 1 from public.businesses b
      where b.id = saved_suppliers.business_id and b.verification_status = 'approved')
  );
create policy saved_suppliers_self_delete on public.saved_suppliers
  for delete to authenticated using (buyer_id = (select auth.uid()));
create policy reviews_public_read on public.reviews
  for select to anon using (is_visible);
create policy reviews_authenticated_read on public.reviews
  for select to authenticated using (is_visible or private.is_admin());
create policy reviews_buyer_insert on public.reviews
  for insert to authenticated with check (
    buyer_id = (select auth.uid()) and exists (select 1 from public.orders o
      where o.id = reviews.order_id and o.buyer_id = (select auth.uid())
        and o.business_id = reviews.business_id and o.status = 'completed')
  );
create policy business_enquiries_parties_read on public.business_enquiries
  for select to authenticated using (
    private.is_business_member(business_id) or requester_id = (select auth.uid()) or private.is_admin()
  );
create policy support_cases_self_read on public.support_cases
  for select to authenticated using (user_id = (select auth.uid()) or private.is_support_staff());
create policy support_cases_self_insert on public.support_cases
  for insert to authenticated with check (user_id = (select auth.uid()) and
    (order_id is null or exists (select 1 from public.orders o where o.id = support_cases.order_id and
      (o.buyer_id = (select auth.uid()) or private.is_business_member(o.business_id)))));
create policy support_cases_staff_update on public.support_cases
  for update to authenticated using (private.is_support_staff()) with check (private.is_support_staff());
create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated using (private.is_admin());
create policy platform_settings_admin_read on public.platform_settings
  for select to authenticated using (private.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('marketplace-images', 'marketplace-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('verification-documents', 'verification-documents', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy marketplace_images_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'marketplace-images');
create policy marketplace_images_member_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'marketplace-images' and private.business_member_for_object(name)
  );
create policy marketplace_images_member_update on storage.objects
  for update to authenticated using (
    bucket_id = 'marketplace-images' and private.business_member_for_object(name)
  ) with check (
    bucket_id = 'marketplace-images' and private.business_member_for_object(name)
  );
create policy marketplace_images_member_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'marketplace-images' and private.business_member_for_object(name)
  );
create policy verification_documents_business_read on storage.objects
  for select to authenticated using (
    bucket_id = 'verification-documents'
    and (private.is_admin() or private.business_member_for_object(name))
  );
create policy verification_documents_business_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'verification-documents' and private.business_member_for_object(name)
  );
