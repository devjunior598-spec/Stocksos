-- Admin-managed account approval for buyer and supplier profiles.
-- Existing accounts remain approved; new registrations start pending.

alter table public.profiles
  add column if not exists account_status text not null default 'approved',
  add column if not exists account_review_note text,
  add column if not exists account_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists account_reviewed_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_account_status_check,
  add constraint profiles_account_status_check
    check (account_status in ('pending', 'approved', 'rejected', 'suspended'));

alter table public.profiles alter column account_status set default 'pending';

create index if not exists profiles_account_review_queue_idx
  on public.profiles(account_status, marketplace_role, created_at desc);

create or replace function public.admin_review_account(
  p_user_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected', 'suspended') then
    raise exception 'Invalid account review status' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Account not found' using errcode = 'P0002'; end if;
  if v_profile.platform_role = 'admin' then
    raise exception 'Administrator accounts cannot be reviewed here' using errcode = '42501';
  end if;

  update public.profiles
  set account_status = p_status,
      account_review_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
      account_reviewed_by = auth.uid(),
      account_reviewed_at = now(),
      updated_at = now()
  where id = p_user_id;

  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    'account_' || p_status,
    'profile',
    p_user_id,
    jsonb_build_object(
      'marketplace_role', v_profile.marketplace_role,
      'note', left(coalesce(p_note, ''), 500)
    )
  );

  insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
  values (
    p_user_id,
    'account:' || p_user_id::text || ':review:' || p_status || ':' || extract(epoch from now())::bigint::text,
    'account_review',
    'Your StockSOS account review was updated',
    case p_status
      when 'approved' then 'Your account is approved. You can now use your StockSOS workspace.'
      when 'rejected' then 'Your account application was not approved. Review the administrator note for the next step.'
      else 'Your account access has been suspended. Contact support if you believe this is an error.'
    end,
    'profile',
    p_user_id
  );
end;
$$;

revoke all on function public.admin_review_account(uuid, text, text) from public, anon;
grant execute on function public.admin_review_account(uuid, text, text) to authenticated;

comment on column public.profiles.account_status is
  'Admin-controlled marketplace access state. New accounts begin pending; existing accounts were preserved as approved.';
