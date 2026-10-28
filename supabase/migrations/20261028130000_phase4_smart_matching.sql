-- Phase 4 foundation: deterministic supplier ranking and delayed SOS expansion.
-- This migration never creates inventory or quotations; it only matches real approved stock.

insert into public.platform_settings (key, value) values
  ('sos_expansion_delay_minutes', '15'::jsonb),
  ('sos_expansion_limit', '50'::jsonb)
on conflict (key) do nothing;

create or replace function public.expand_sos_request(p_request_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.sos_requests%rowtype;
  v_business_id uuid;
  v_added integer := 0;
  v_score integer;
  v_reasons text[];
begin
  if (auth.jwt() ->> 'role') <> 'service_role' and not private.is_admin() then
    raise exception 'Trusted service required' using errcode = '42501';
  end if;
  select * into v_request from public.sos_requests where id = p_request_id for update;
  if not found or v_request.status <> 'open' or v_request.expires_at <= now() then return 0; end if;
  for v_business_id in
    select b.id
    from public.businesses b
    where b.verification_status = 'approved'
      and b.primary_category_id = v_request.category_id
      and exists (
        select 1 from public.products p join public.inventory i on i.product_id = p.id
        where p.business_id = b.id and p.category_id = v_request.category_id
          and p.is_active and p.visibility = 'public' and i.quantity_available > 0
      )
      and not exists (select 1 from public.supplier_matches sm where sm.request_id = v_request.id and sm.business_id = b.id)
    order by
      case when lower(trim(b.city)) = lower(trim(v_request.city)) then 0 else 1 end,
      b.created_at
    limit greatest(1, least(100, coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'sos_expansion_limit'), 50)))
  loop
    if exists (select 1 from public.businesses b where b.id = v_business_id and lower(trim(b.city)) = lower(trim(v_request.city))) then
      v_score := 100;
      v_reasons := array['category_match', 'city_match', 'verified_supplier', 'stock_available'];
    else
      v_score := 70;
      v_reasons := array['category_match', 'network_expansion', 'verified_supplier', 'stock_available'];
    end if;
    insert into public.supplier_matches (request_id, business_id, match_score, reason_codes)
      values (v_request.id, v_business_id, v_score, v_reasons)
      on conflict (request_id, business_id) do nothing;
    if found then
      v_added := v_added + 1;
      insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
      select bm.user_id, 'sos:' || v_request.id::text || ':' || bm.user_id::text,
        'matching_request', 'An SOS request matches your stock',
        case when v_score = 100 then 'A buyer in your city needs stock you may carry.' else 'A buyer request has expanded to your business category.' end,
        'sos_request', v_request.id
      from public.business_memberships bm
      where bm.business_id = v_business_id and bm.role in ('owner', 'admin', 'fulfillment')
      on conflict (event_key) do nothing;
      insert into public.notification_jobs (event_key, user_id, channel, payload)
      select 'sos-email:' || v_request.id::text || ':' || bm.user_id::text,
        bm.user_id, 'email', jsonb_build_object('kind', 'matching_request', 'request_id', v_request.id, 'expanded', true)
      from public.business_memberships bm
      where bm.business_id = v_business_id and bm.role in ('owner', 'admin', 'fulfillment')
      on conflict (event_key) do nothing;
    end if;
  end loop;
  return v_added;
end;
$$;

create or replace function public.expand_open_sos_requests(p_limit integer default 50)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_request record;
  v_count integer := 0;
begin
  if (auth.jwt() ->> 'role') <> 'service_role' and not private.is_admin() then
    raise exception 'Trusted service required' using errcode = '42501';
  end if;
  for v_request in
    select r.id from public.sos_requests r
    where r.status = 'open' and r.expires_at > now()
      and r.created_at <= now() - make_interval(mins => greatest(1, least(1440, coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'sos_expansion_delay_minutes'), 15))))
    order by r.created_at limit greatest(1, least(100, coalesce(p_limit, 50)))
  loop
    v_count := v_count + public.expand_sos_request(v_request.id);
  end loop;
  return v_count;
end;
$$;

revoke all on function public.expand_sos_request(uuid) from public, anon, authenticated;
revoke all on function public.expand_open_sos_requests(integer) from public, anon, authenticated;
grant execute on function public.expand_sos_request(uuid) to service_role;
grant execute on function public.expand_open_sos_requests(integer) to service_role;
