-- Read-only schema audit. Run with a privileged staging connection after all
-- migrations have been applied; it raises on missing RLS or unsafe RPC grants.
\set ON_ERROR_STOP on

do $$
declare
  v_table text;
  v_rls boolean;
  v_tables text[] := array[
    'profiles', 'businesses', 'business_memberships', 'supplier_verification_files',
    'products', 'inventory', 'sos_requests', 'supplier_matches', 'quotations',
    'order_groups', 'orders', 'order_items', 'stock_reservations', 'payments',
    'refunds', 'delivery_partners', 'deliveries', 'notifications', 'notification_jobs',
    'subscription_plans', 'business_subscriptions', 'saved_suppliers', 'reviews',
    'business_enquiries', 'support_cases', 'audit_logs', 'platform_settings'
  ];
begin
  foreach v_table in array v_tables loop
    select c.relrowsecurity into v_rls
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = v_table and c.relkind = 'r';
    if not found or v_rls is not true then
      raise exception 'RLS is missing on public.%', v_table;
    end if;
  end loop;

  -- Authenticated execution is expected; the function itself checks admin role.
  if has_function_privilege('anon', 'public.admin_review_account(uuid,text,text)', 'EXECUTE') then
    raise exception 'Anonymous users can execute admin_review_account';
  end if;
  if has_function_privilege('authenticated', 'public.admin_review_account(uuid,text,text)', 'EXECUTE') is false then
    raise exception 'Authenticated users cannot reach admin_review_account';
  end if;
  if has_function_privilege('anon', 'public.consume_rate_limit(text,text,integer,integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.consume_rate_limit(text,text,integer,integer)', 'EXECUTE') then
    raise exception 'Non-service roles can execute consume_rate_limit';
  end if;
  if has_function_privilege('service_role', 'public.consume_rate_limit(text,text,integer,integer)', 'EXECUTE') is false then
    raise exception 'Service role cannot execute consume_rate_limit';
  end if;
end;
$$;

select 'RLS audit passed' as result;
