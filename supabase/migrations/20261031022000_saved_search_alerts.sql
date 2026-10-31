create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 80),
  query text not null check (length(trim(query)) between 2 and 180),
  category_id uuid references public.categories(id),
  country char(2),
  region text,
  city text,
  min_price_kobo bigint check (min_price_kobo is null or min_price_kobo >= 0),
  max_price_kobo bigint check (max_price_kobo is null or max_price_kobo >= 0),
  is_active boolean not null default true,
  last_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (country is null or country ~ '^[A-Z]{2}$'),
  check (max_price_kobo is null or min_price_kobo is null or max_price_kobo >= min_price_kobo)
);

create index if not exists saved_searches_user_active_idx on public.saved_searches(user_id, is_active, created_at desc);
alter table public.saved_searches enable row level security;
grant select, insert, update, delete on public.saved_searches to authenticated;
create policy saved_searches_self_read on public.saved_searches for select to authenticated using (user_id = (select auth.uid()));
create policy saved_searches_self_insert on public.saved_searches for insert to authenticated with check (user_id = (select auth.uid()));
create policy saved_searches_self_update on public.saved_searches for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saved_searches_self_delete on public.saved_searches for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.process_saved_search_alerts(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_search record;
  v_matches integer;
  v_count integer := 0;
  v_pattern text;
begin
  if (auth.jwt() ->> 'role') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  for v_search in
    select * from public.saved_searches
    where is_active and (last_alerted_at is null or last_alerted_at < now() - interval '24 hours')
    order by created_at asc limit greatest(1, least(500, coalesce(p_limit, 100)))
    for update
  loop
    v_pattern := '%' || replace(replace(trim(v_search.query), '%', '\%'), '_', '\_') || '%';
    select count(*) into v_matches
    from public.products p
    join public.businesses b on b.id = p.business_id
    join public.inventory i on i.product_id = p.id
    where p.is_active and p.visibility = 'public'
      and b.verification_status = 'approved' and b.visibility = 'public'
      and i.quantity_available > 0
      and (p.name ilike v_pattern escape '\' or coalesce(p.brand, '') ilike v_pattern escape '\' or coalesce(p.specifications, '') ilike v_pattern escape '\')
      and (v_search.category_id is null or p.category_id = v_search.category_id)
      and (v_search.country is null or b.country = v_search.country)
      and (v_search.region is null or lower(coalesce(b.region, '')) = lower(v_search.region))
      and (v_search.city is null or lower(b.city) = lower(v_search.city))
      and (v_search.min_price_kobo is null or i.unit_price_kobo >= v_search.min_price_kobo)
      and (v_search.max_price_kobo is null or i.unit_price_kobo <= v_search.max_price_kobo);

    if v_matches > 0 then
      insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
      values (v_search.user_id, 'saved-search:' || v_search.id::text || ':' || to_char(now(), 'YYYY-MM-DD'),
        'saved_search_match', 'Saved search found new stock',
        v_matches || ' available listing' || case when v_matches = 1 then '' else 's' end || ' match “' || v_search.name || '”.',
        'saved_search', v_search.id)
      on conflict (event_key) do nothing;
      update public.saved_searches set last_alerted_at = now(), updated_at = now() where id = v_search.id;
      v_count := v_count + 1;
    else
      update public.saved_searches set updated_at = now() where id = v_search.id;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.process_saved_search_alerts(integer) from public, anon, authenticated;
grant execute on function public.process_saved_search_alerts(integer) to service_role;
