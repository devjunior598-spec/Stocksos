-- Supplier sales assistant configuration. Entitlements are server-managed only:
-- the feature cannot be switched on by editing a plan or client-side state.
create table public.sales_assistant_entitlements (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  status text not null check (status in ('active', 'expired', 'cancelled')),
  provider text not null,
  payment_reference text not null unique,
  paid_through timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sales_assistant_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  enabled boolean not null default false,
  greeting text not null default 'Hi! Ask me about this product and I will help you get the details you need.',
  delivery_notes text not null default '',
  returns_notes text not null default '',
  handoff_notes text not null default '',
  updated_at timestamptz not null default now(),
  constraint sales_assistant_greeting_length check (length(greeting) between 10 and 240),
  constraint sales_assistant_delivery_length check (length(delivery_notes) <= 800),
  constraint sales_assistant_returns_length check (length(returns_notes) <= 800),
  constraint sales_assistant_handoff_length check (length(handoff_notes) <= 500)
);

alter table public.sales_assistant_entitlements enable row level security;
alter table public.sales_assistant_settings enable row level security;
revoke all on public.sales_assistant_entitlements from public, anon, authenticated;
revoke all on public.sales_assistant_settings from public, anon, authenticated;
grant select on public.sales_assistant_entitlements to authenticated;
grant select on public.sales_assistant_settings to authenticated;
grant insert, update on public.sales_assistant_settings to authenticated;

create policy sales_assistant_entitlements_member_read
  on public.sales_assistant_entitlements for select to authenticated
  using (private.is_business_member(business_id, array['owner','admin']) or private.is_admin());

create policy sales_assistant_settings_member_read
  on public.sales_assistant_settings for select to authenticated
  using (private.is_business_member(business_id, array['owner','admin']) or private.is_admin());

create policy sales_assistant_settings_member_insert
  on public.sales_assistant_settings for insert to authenticated
  with check (private.is_business_member(business_id, array['owner','admin'])
    and (not enabled or exists (
      select 1 from public.sales_assistant_entitlements e
      where e.business_id = sales_assistant_settings.business_id
        and e.status = 'active' and e.paid_through > now()
    )));

create policy sales_assistant_settings_member_update
  on public.sales_assistant_settings for update to authenticated
  using (private.is_business_member(business_id, array['owner','admin']))
  with check (private.is_business_member(business_id, array['owner','admin'])
    and (not enabled or exists (
      select 1 from public.sales_assistant_entitlements e
      where e.business_id = sales_assistant_settings.business_id
        and e.status = 'active' and e.paid_through > now()
    )));
