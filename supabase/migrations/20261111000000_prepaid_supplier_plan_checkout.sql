-- Supplier plan upgrades are prepaid, one-time Paystack payments. This migration
-- does not enable billing or configure a provider account.

-- The legacy monthly_price_kobo column was repurposed to USD cents by the global
-- marketplace migration. Keep it for existing admin screens, but use explicit
-- currency prices for every new checkout. No NGN price is inferred from USD.
create table public.subscription_plan_prices (
  plan_id text not null references public.subscription_plans(id),
  currency char(3) not null check (currency in ('NGN', 'USD')),
  amount_minor bigint not null check (amount_minor > 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (plan_id, currency)
);

insert into public.subscription_plan_prices (plan_id, currency, amount_minor, is_active)
select id, 'USD', monthly_price_kobo, is_active
from public.subscription_plans
where id <> 'free' and monthly_price_kobo > 0;

create table public.subscription_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  created_by uuid not null references public.profiles(id),
  plan_id text not null references public.subscription_plans(id),
  currency char(3) not null check (currency in ('NGN', 'USD')),
  amount_minor bigint not null check (amount_minor > 0),
  billing_country char(2) not null check (billing_country ~ '^[A-Z]{2}$'),
  payment_method text not null check (payment_method in ('card', 'bank_transfer')),
  provider_reference text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed')),
  provider_transaction_id text unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  completed_at timestamptz,
  constraint subscription_checkout_country_channel_check
    check (payment_method <> 'bank_transfer' or (billing_country = 'NG' and currency = 'NGN')),
  constraint subscription_checkout_country_currency_check
    check ((billing_country = 'NG' and currency = 'NGN') or
      (billing_country <> 'NG' and currency = 'USD')),
  constraint subscription_checkout_completion_check
    check ((status = 'paid' and provider_transaction_id is not null and completed_at is not null)
      or (status <> 'paid' and provider_transaction_id is null and completed_at is null))
);

create index subscription_checkout_business_created_idx
  on public.subscription_checkout_intents (business_id, created_at desc);
create index subscription_checkout_pending_expiry_idx
  on public.subscription_checkout_intents (expires_at)
  where status = 'pending';

-- One immutable ledger row for each successful provider transaction. The paid
-- period is recorded here even when the business later changes or expires plans.
create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  checkout_intent_id uuid not null unique references public.subscription_checkout_intents(id),
  business_id uuid not null references public.businesses(id),
  plan_id text not null references public.subscription_plans(id),
  provider text not null default 'paystack' check (provider = 'paystack'),
  provider_reference text not null unique,
  provider_transaction_id text not null unique,
  currency char(3) not null check (currency in ('NGN', 'USD')),
  amount_minor bigint not null check (amount_minor > 0),
  paid_at timestamptz not null,
  period_starts_at timestamptz not null,
  period_ends_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint subscription_payment_period_check check (period_ends_at > period_starts_at)
);

create function private.prevent_subscription_payment_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Subscription payment ledger entries cannot be changed' using errcode = '42501';
end;
$$;
revoke all on function private.prevent_subscription_payment_mutation()
  from public, anon, authenticated;
create trigger subscription_payments_immutable
  before update or delete on public.subscription_payments
  for each row execute function private.prevent_subscription_payment_mutation();

create function private.prevent_subscription_checkout_snapshot_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if row(new.business_id, new.created_by, new.plan_id, new.currency,
      new.amount_minor, new.billing_country, new.payment_method,
      new.provider_reference, new.created_at, new.expires_at)
    is distinct from
    row(old.business_id, old.created_by, old.plan_id, old.currency,
      old.amount_minor, old.billing_country, old.payment_method,
      old.provider_reference, old.created_at, old.expires_at) then
    raise exception 'Checkout price and ownership cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_subscription_checkout_snapshot_change()
  from public, anon, authenticated;
create trigger subscription_checkout_snapshot_immutable
  before update on public.subscription_checkout_intents
  for each row execute function private.prevent_subscription_checkout_snapshot_change();

create index subscription_payments_business_paid_idx
  on public.subscription_payments (business_id, paid_at desc);

alter table public.subscription_plan_prices enable row level security;
alter table public.subscription_checkout_intents enable row level security;
alter table public.subscription_payments enable row level security;

revoke all on public.subscription_plan_prices, public.subscription_checkout_intents,
  public.subscription_payments from public, anon, authenticated, service_role;
grant select on public.subscription_plan_prices to anon, authenticated, service_role;
grant select on public.subscription_checkout_intents, public.subscription_payments to authenticated;
grant select, insert, update on public.subscription_checkout_intents to service_role;
grant select, insert on public.subscription_payments to service_role;

create policy subscription_plan_prices_public_read
  on public.subscription_plan_prices for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.subscription_plans p
    where p.id = plan_id and p.is_active
  ));
create policy subscription_plan_prices_admin_read
  on public.subscription_plan_prices for select to authenticated
  using (private.is_admin());
create policy subscription_checkout_owner_read
  on public.subscription_checkout_intents for select to authenticated
  using (private.account_not_removed() and
    (created_by = (select auth.uid()) or private.is_admin()) and
    (private.is_business_member(business_id, array['owner','admin']) or private.is_admin()));
create policy subscription_payments_owner_read
  on public.subscription_payments for select to authenticated
  using (private.account_not_removed() and
    (private.is_business_member(business_id, array['owner','admin']) or private.is_admin()));

-- Called with the signed-in user's Supabase client. Price and membership are
-- checked in one database transaction; the browser cannot choose the amount.
create function public.create_subscription_checkout_intent(
  p_business_id uuid, p_plan_id text, p_billing_country text,
  p_payment_method text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_currency char(3);
  v_price public.subscription_plan_prices%rowtype;
  v_intent public.subscription_checkout_intents%rowtype;
begin
  if auth.uid() is null or not private.account_not_removed() or
    not private.is_business_member(p_business_id, array['owner','admin']) then
    raise exception 'Business owner access required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.verification_status = 'approved'
      and b.removed_at is null
  ) then
    raise exception 'Approved supplier business required' using errcode = '42501';
  end if;
  if p_billing_country is null or p_billing_country !~ '^[A-Z]{2}$' or
    p_payment_method not in ('card', 'bank_transfer') or
    (p_billing_country <> 'NG' and p_payment_method <> 'card') then
    raise exception 'Unsupported billing country or payment method' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.country = p_billing_country
  ) then
    raise exception 'Billing country must match your business country'
      using errcode = '22023';
  end if;
  v_currency := case when p_billing_country = 'NG' then 'NGN' else 'USD' end;
  select pp.* into v_price from public.subscription_plan_prices pp
  join public.subscription_plans p on p.id = pp.plan_id
  where pp.plan_id = p_plan_id and pp.currency = v_currency
    and pp.is_active and p.is_active and p.id <> 'free'
  for share of pp;
  if not found then
    raise exception 'A paid price for this country is not available' using errcode = 'P0002';
  end if;
  insert into public.subscription_checkout_intents (
    business_id, created_by, plan_id, currency, amount_minor,
    billing_country, payment_method, provider_reference
  ) values (
    p_business_id, auth.uid(), p_plan_id, v_currency, v_price.amount_minor,
    p_billing_country, p_payment_method,
    'ssub-' || replace(gen_random_uuid()::text, '-', '')
  ) returning * into v_intent;
  return jsonb_build_object(
    'id', v_intent.id, 'business_id', v_intent.business_id,
    'plan_id', v_intent.plan_id, 'currency', v_intent.currency,
    'amount_minor', v_intent.amount_minor,
    'billing_country', v_intent.billing_country,
    'payment_method', v_intent.payment_method,
    'provider_reference', v_intent.provider_reference,
    'expires_at', v_intent.expires_at
  );
end;
$$;
revoke all on function public.create_subscription_checkout_intent(uuid, text, text, text)
  from public, anon;
grant execute on function public.create_subscription_checkout_intent(uuid, text, text, text)
  to authenticated;

-- Only the backend service-role client may call this after verifying the
-- transaction against Paystack. Reference, amount, currency and transaction ID
-- must all match the immutable checkout snapshot. Replayed events are harmless.
create function public.confirm_subscription_payment(
  p_reference text, p_provider_transaction_id text, p_paid_at timestamptz,
  p_amount_minor bigint, p_currency text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_intent public.subscription_checkout_intents%rowtype;
  v_existing public.subscription_payments%rowtype;
  v_subscription_id uuid;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if p_reference is null or p_provider_transaction_id is null or
    length(trim(p_provider_transaction_id)) = 0 or
    p_paid_at is null or p_paid_at > now() + interval '5 minutes' then
    raise exception 'Invalid provider payment details' using errcode = '22023';
  end if;
  select * into v_intent from public.subscription_checkout_intents
    where provider_reference = p_reference for update;
  if not found then
    raise exception 'Checkout reference not found' using errcode = 'P0002';
  end if;
  if v_intent.amount_minor <> p_amount_minor or v_intent.currency <> p_currency then
    raise exception 'Provider payment amount or currency mismatch' using errcode = '22023';
  end if;
  if v_intent.status = 'paid' then
    select * into v_existing from public.subscription_payments
      where checkout_intent_id = v_intent.id;
    if not found or v_existing.provider_transaction_id <> p_provider_transaction_id then
      raise exception 'Payment reference conflict' using errcode = '23505';
    end if;
    select bs.id into v_subscription_id from public.business_subscriptions bs
      where bs.provider_reference = p_reference;
    return jsonb_build_object('subscription_id', v_subscription_id,
      'period_starts_at', v_existing.period_starts_at,
      'period_ends_at', v_existing.period_ends_at, 'already_recorded', true);
  end if;
  -- A provider initialization timeout may have marked the attempt failed even
  -- though payment completed. A separately verified transaction can recover it.
  if v_intent.status not in ('pending', 'failed') then
    raise exception 'Checkout cannot be confirmed' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.subscription_payments sp
    where sp.provider_transaction_id = p_provider_transaction_id
  ) then
    raise exception 'Provider transaction already recorded' using errcode = '23505';
  end if;
  -- Serialize different paid checkout references for the same business.
  perform pg_advisory_xact_lock(hashtextextended(v_intent.business_id::text, 0));
  select greatest(now(), coalesce(max(bs.period_ends_at), now()))
    into v_period_start
    from public.business_subscriptions bs
    where bs.business_id = v_intent.business_id and bs.status = 'active'
      and bs.period_ends_at > now();
  v_period_end := v_period_start + interval '1 month';

  insert into public.business_subscriptions (
    business_id, plan_id, status, provider, provider_reference,
    period_starts_at, period_ends_at
  ) values (
    v_intent.business_id, v_intent.plan_id, 'active', 'paystack', p_reference,
    v_period_start, v_period_end
  ) returning id into v_subscription_id;

  insert into public.subscription_payments (
    checkout_intent_id, business_id, plan_id, provider_reference,
    provider_transaction_id, currency, amount_minor, paid_at,
    period_starts_at, period_ends_at
  ) values (
    v_intent.id, v_intent.business_id, v_intent.plan_id, p_reference,
    p_provider_transaction_id, v_intent.currency, v_intent.amount_minor,
    p_paid_at, v_period_start, v_period_end
  );

  update public.subscription_checkout_intents
    set status = 'paid', provider_transaction_id = p_provider_transaction_id,
      completed_at = now()
    where id = v_intent.id;

  return jsonb_build_object('subscription_id', v_subscription_id,
    'period_starts_at', v_period_start, 'period_ends_at', v_period_end,
    'already_recorded', false);
end;
$$;
revoke all on function public.confirm_subscription_payment(text, text, timestamptz, bigint, text)
  from public, anon, authenticated;
grant execute on function public.confirm_subscription_payment(text, text, timestamptz, bigint, text)
  to service_role;

-- Existing admin plan controls continue to edit USD cents. A separate admin
-- function sets NGN kobo when the business chooses a real NGN price.
create or replace function public.admin_update_subscription_plan(
  p_plan_id text, p_monthly_price_kobo bigint, p_benefits jsonb, p_is_active boolean
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_monthly_price_kobo < 0 or jsonb_typeof(p_benefits) <> 'array' then
    raise exception 'Invalid plan configuration' using errcode = '22023';
  end if;
  update public.subscription_plans set monthly_price_kobo = p_monthly_price_kobo,
    benefits = p_benefits, is_active = p_is_active, updated_at = now()
    where id = p_plan_id;
  if not found then raise exception 'Subscription plan not found' using errcode = 'P0002'; end if;
  if p_plan_id <> 'free' then
    if p_monthly_price_kobo > 0 then
      insert into public.subscription_plan_prices (plan_id, currency, amount_minor, is_active)
      values (p_plan_id, 'USD', p_monthly_price_kobo, p_is_active)
      on conflict (plan_id, currency) do update set amount_minor = excluded.amount_minor,
        is_active = excluded.is_active, updated_at = now();
    else
      update public.subscription_plan_prices set is_active = false, updated_at = now()
        where plan_id = p_plan_id and currency = 'USD';
    end if;
    update public.subscription_plan_prices set is_active = p_is_active, updated_at = now()
      where plan_id = p_plan_id and currency = 'NGN';
  end if;
  insert into public.audit_logs (actor_id, action, target_type, details)
    values (auth.uid(), 'subscription_plan_updated', 'subscription_plan',
      jsonb_build_object('plan_id', p_plan_id, 'monthly_price_usd_cents', p_monthly_price_kobo));
end;
$$;

create function public.admin_set_subscription_plan_price(
  p_plan_id text, p_currency text, p_amount_minor bigint, p_is_active boolean
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_plan_id = 'free' or p_currency not in ('NGN', 'USD') or p_amount_minor <= 0 then
    raise exception 'Invalid plan price' using errcode = '22023';
  end if;
  if not exists (select 1 from public.subscription_plans where id = p_plan_id) then
    raise exception 'Subscription plan not found' using errcode = 'P0002';
  end if;
  insert into public.subscription_plan_prices (plan_id, currency, amount_minor, is_active)
  values (p_plan_id, p_currency::char(3), p_amount_minor, p_is_active)
  on conflict (plan_id, currency) do update set amount_minor = excluded.amount_minor,
    is_active = excluded.is_active, updated_at = now();
  if p_currency = 'USD' then
    update public.subscription_plans set monthly_price_kobo = p_amount_minor,
      updated_at = now() where id = p_plan_id;
  end if;
  insert into public.audit_logs (actor_id, action, target_type, details)
    values (auth.uid(), 'subscription_plan_price_updated', 'subscription_plan',
      jsonb_build_object('plan_id', p_plan_id, 'currency', p_currency,
        'amount_minor', p_amount_minor, 'is_active', p_is_active));
end;
$$;
revoke all on function public.admin_set_subscription_plan_price(text, text, bigint, boolean)
  from public, anon;
grant execute on function public.admin_set_subscription_plan_price(text, text, bigint, boolean)
  to authenticated;
