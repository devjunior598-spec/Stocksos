-- Saved buyer sourcing context. These fields are protected by the existing
-- profiles self-or-admin RLS policies and are never exposed to suppliers.
alter table public.profiles
  add column if not exists home_country char(2),
  add column if not exists home_region text,
  add column if not exists home_postal_code text,
  add column if not exists home_area text,
  add column if not exists home_address text,
  add column if not exists default_delivery_method text not null default 'flexible';

alter table public.profiles
  drop constraint if exists profiles_home_country_check,
  add constraint profiles_home_country_check check (home_country is null or home_country ~ '^[A-Z]{2}$'),
  drop constraint if exists profiles_default_delivery_method_check,
  add constraint profiles_default_delivery_method_check check (default_delivery_method in ('pickup', 'delivery', 'flexible'));

comment on column public.profiles.home_address is 'Private buyer fulfilment address; never copied into supplier-facing matches.';
