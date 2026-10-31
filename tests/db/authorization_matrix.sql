-- Authorization matrix for a disposable StockSOS database.
-- Run after every migration with:
--   psql -v ON_ERROR_STOP=1 "$STAGING_DATABASE_URL" -f tests/db/authorization_matrix.sql
-- All fixtures are rolled back. This never targets production data.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11000000-0000-4000-8000-000000000001', 'stocksos-auth-buyer@example.com', '{"full_name":"RLS Buyer"}'::jsonb),
  ('11000000-0000-4000-8000-000000000002', 'stocksos-auth-supplier@example.com', '{"full_name":"RLS Supplier","marketplace_role":"supplier"}'::jsonb),
  ('11000000-0000-4000-8000-000000000003', 'stocksos-auth-admin@example.com', '{"full_name":"RLS Admin"}'::jsonb),
  ('11000000-0000-4000-8000-000000000004', 'stocksos-auth-other@example.com', '{"full_name":"RLS Other"}'::jsonb);

update public.profiles set marketplace_role = 'buyer', account_status = 'approved'
where id = '11000000-0000-4000-8000-000000000001';
update public.profiles set marketplace_role = 'supplier', account_status = 'approved'
where id = '11000000-0000-4000-8000-000000000002';
update public.profiles set platform_role = 'admin', marketplace_role = 'buyer', account_status = 'approved'
where id = '11000000-0000-4000-8000-000000000003';
update public.profiles set marketplace_role = 'buyer', account_status = 'approved'
where id = '11000000-0000-4000-8000-000000000004';

insert into public.businesses (id, name, slug, primary_category_id, city, country, verification_status, created_by)
select '21000000-0000-4000-8000-000000000001', 'RLS Matrix Supplier', 'stocksos-auth-matrix-supplier',
  id, 'New York', 'US', 'approved', '11000000-0000-4000-8000-000000000002'
from public.categories where slug = 'auto-parts';
insert into public.business_memberships (business_id, user_id, role)
values ('21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 'owner');

insert into public.sos_requests (id, requester_id, category_id, product_name, quantity, city, country)
select '31000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001',
  id, 'RLS Matrix Part', 1, 'New York', 'US'
from public.categories where slug = 'auto-parts';

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);

-- Buyer can read their own SOS request, but cannot create supplier inventory.
do $$
declare
  v_succeeded boolean := false;
begin
  if (select count(*) from public.sos_requests where id = '31000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'Buyer cannot read their own SOS request';
  end if;
  begin
    insert into public.products (business_id, category_id, name, created_by)
    select '21000000-0000-4000-8000-000000000001', id, 'Unauthorized buyer product',
      '11000000-0000-4000-8000-000000000001'
    from public.categories where slug = 'auto-parts';
    v_succeeded := true;
  exception when others then null;
  end;
  if v_succeeded then raise exception 'Buyer was able to insert supplier inventory'; end if;
end;
$$;

-- Supplier can create inventory through the protected RPC.
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000002', true);
do $$
declare v_product_id uuid;
begin
  select public.create_supplier_product(
    '21000000-0000-4000-8000-000000000001',
    id, 'Authorized supplier product', 'StockSOS', null, 'new', 10, 2500, 'public'
  ) into v_product_id from public.categories where slug = 'auto-parts';
  if v_product_id is null then raise exception 'Supplier RPC did not create a product'; end if;
end;
$$;

-- Supplier cannot execute an admin-only RPC.
do $$
declare v_succeeded boolean := false;
begin
  begin perform public.admin_update_marketplace_fee(500); v_succeeded := true; exception when others then null; end;
  if v_succeeded then raise exception 'Supplier was able to update platform settings'; end if;
end;
$$;

-- Unrelated users cannot read the buyer request.
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000004', true);
do $$
begin
  if exists (select 1 from public.sos_requests where id = '31000000-0000-4000-8000-000000000001') then
    raise exception 'Unrelated user can read another buyer SOS request';
  end if;
end;
$$;

-- Admin can read the request and execute the admin RPC.
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000003', true);
do $$
begin
  if not exists (select 1 from public.sos_requests where id = '31000000-0000-4000-8000-000000000001') then
    raise exception 'Admin cannot read the SOS request';
  end if;
  perform public.admin_update_marketplace_fee(500);
end;
$$;

rollback;
