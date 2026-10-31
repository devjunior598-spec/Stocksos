create extension if not exists pgcrypto with schema extensions;

create table if not exists private.auth_login_throttles (
  bucket_key text primary key,
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);

revoke all on private.auth_login_throttles from public, anon, authenticated;

create or replace function private.consume_login_bucket(p_bucket_key text, p_limit integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_row private.auth_login_throttles%rowtype;
  v_now timestamptz := now();
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_bucket_key, 0));
  select * into v_row from private.auth_login_throttles where bucket_key = p_bucket_key for update;
  if found and v_row.locked_until > v_now then return false; end if;
  if not found then
    insert into private.auth_login_throttles(bucket_key, attempt_count, window_started_at)
      values (p_bucket_key, 1, v_now);
    return true;
  end if;
  if v_row.window_started_at <= v_now - interval '15 minutes' then
    update private.auth_login_throttles set attempt_count = 1,
      window_started_at = v_now, locked_until = null where bucket_key = p_bucket_key;
    return true;
  end if;
  v_row.attempt_count := v_row.attempt_count + 1;
  update private.auth_login_throttles
    set attempt_count = v_row.attempt_count,
        locked_until = case when v_row.attempt_count > p_limit then v_now + interval '15 minutes' else null end
    where bucket_key = p_bucket_key;
  return v_row.attempt_count <= p_limit;
end;
$$;

create or replace function public.consume_login_attempt(p_email text, p_ip_key text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_email_key text;
  v_ip_key text;
  v_account_allowed boolean;
  v_ip_allowed boolean;
begin
  if length(trim(coalesce(p_email, ''))) not between 3 and 254 then return false; end if;
  if coalesce(p_ip_key, '') !~ '^[0-9a-f]{64}$' then return false; end if;
  v_email_key := 'account:' || encode(extensions.digest('account:' || lower(trim(p_email)), 'sha256'), 'hex');
  v_ip_key := 'ip:' || lower(p_ip_key);
  -- Account keys always sort before IP keys, keeping lock order stable.
  v_account_allowed := private.consume_login_bucket(v_email_key, 8);
  v_ip_allowed := private.consume_login_bucket(v_ip_key, 40);
  return v_account_allowed and v_ip_allowed;
end;
$$;

create or replace function public.clear_login_account_lockout()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_bucket_key text;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Authenticated account required' using errcode = '42501';
  end if;
  v_bucket_key := 'account:' || encode(extensions.digest('account:' || v_email, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_bucket_key, 0));
  delete from private.auth_login_throttles where bucket_key = v_bucket_key;
end;
$$;

revoke all on function private.consume_login_bucket(text, integer) from public, anon, authenticated;
revoke all on function public.consume_login_attempt(text, text) from public, anon, authenticated;
revoke all on function public.clear_login_account_lockout() from public, anon, authenticated;
grant execute on function public.consume_login_attempt(text, text) to anon, authenticated;
grant execute on function public.clear_login_account_lockout() to authenticated;
