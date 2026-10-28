-- Run against a disposable StockSOS database with psql -v ON_ERROR_STOP=1 -f.
-- All fixtures and assertions run in a transaction that is rolled back.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'stocksos-rls-buyer@example.com', '{}'::jsonb),
  ('10000000-0000-4000-8000-000000000002', 'stocksos-rls-supplier@example.com', '{}'::jsonb),
  ('10000000-0000-4000-8000-000000000003', 'stocksos-rls-other@example.com', '{}'::jsonb);

insert into public.businesses (id, name, slug, primary_category_id, city, verification_status, created_by)
select '20000000-0000-4000-8000-000000000001', 'RLS Test Supplier', 'stocksos-rls-test-supplier',
  id, 'Ibadan', 'approved', '10000000-0000-4000-8000-000000000002'
from public.categories where slug = 'auto-parts';

insert into public.business_memberships (business_id, user_id, role) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'owner');

insert into public.sos_requests (id, requester_id, category_id, product_name, quantity, city)
select '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  id, 'RLS Test Part', 1, 'Ibadan'
from public.categories where slug = 'auto-parts';

insert into public.supplier_matches (request_id, business_id, match_score) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 100);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
begin
  if (select count(*) from public.sos_requests where id = '30000000-0000-4000-8000-000000000001') <> 1
    or (select count(*) from public.supplier_matches where request_id = '30000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'Buyer cannot read their request and its match';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$
begin
  if (select count(*) from public.sos_requests where id = '30000000-0000-4000-8000-000000000001') <> 1
    or (select count(*) from public.supplier_matches where request_id = '30000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'Matched supplier cannot read the request and match';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
do $$
begin
  if exists (select 1 from public.sos_requests where id = '30000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.supplier_matches where request_id = '30000000-0000-4000-8000-000000000001') then
    raise exception 'Unrelated user can read a request or match';
  end if;
end;
$$;

rollback;
