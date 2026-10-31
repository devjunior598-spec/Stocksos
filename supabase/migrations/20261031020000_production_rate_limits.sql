-- Server-side rate limits for unauthenticated and authenticated application endpoints.
-- The public wrapper is intentionally callable only with the service role. The
-- Next.js server uses SUPABASE_SECRET_KEY; browser clients cannot mint buckets.
create table if not exists private.rate_limit_buckets (
  bucket_key text primary key,
  request_count integer not null default 0,
  window_started_at timestamptz not null default now()
);

revoke all on private.rate_limit_buckets from public, anon, authenticated;

create or replace function public.consume_rate_limit(
  p_scope text,
  p_identifier text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket_key text;
  v_count integer;
  v_started_at timestamptz;
  v_now timestamptz := now();
begin
  if (auth.jwt() ->> 'role') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if coalesce(p_scope, '') !~ '^[a-z0-9._-]{2,64}$'
    or coalesce(p_identifier, '') = ''
    or p_limit not between 1 and 1000
    or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate limit parameters' using errcode = '22023';
  end if;

  v_bucket_key := lower(trim(p_scope)) || ':' ||
    encode(extensions.digest(lower(trim(p_identifier)), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_bucket_key, 0));

  select request_count, window_started_at
    into v_count, v_started_at
    from private.rate_limit_buckets
    where bucket_key = v_bucket_key
    for update;

  if not found or v_started_at <= v_now - make_interval(secs => p_window_seconds) then
    insert into private.rate_limit_buckets(bucket_key, request_count, window_started_at)
      values (v_bucket_key, 1, v_now)
    on conflict (bucket_key) do update set request_count = 1, window_started_at = v_now;
    return true;
  end if;

  if v_count >= p_limit then
    return false;
  end if;

  update private.rate_limit_buckets
    set request_count = request_count + 1
    where bucket_key = v_bucket_key;
  return true;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
