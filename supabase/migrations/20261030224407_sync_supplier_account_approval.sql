-- Supplier business approval and supplier account approval are one workflow.
-- Previously the business was approved while profiles.account_status remained
-- pending, so requireUser() continued redirecting the supplier to /account-status.

create or replace function public.admin_review_business(
  p_business_id uuid, p_status text, p_note text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_status not in ('approved', 'rejected', 'suspended') then
    raise exception 'Invalid review status' using errcode = '22023';
  end if;

  update public.businesses
  set verification_status = p_status, updated_at = now()
  where id = p_business_id
  returning created_by into v_owner;
  if not found then raise exception 'Business not found' using errcode = 'P0002'; end if;

  -- Keep supplier access and supplier business verification in sync. The
  -- nested function repeats the admin check and writes the account audit and
  -- notification in the same transaction.
  perform public.admin_review_account(v_owner, p_status, p_note);

  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'business_verification_' || p_status, 'business', p_business_id,
    jsonb_build_object('note', left(coalesce(p_note, ''), 500), 'account_synced', true));
  insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
  values (v_owner, 'business:' || p_business_id::text || ':review:' || p_status || ':' || now()::date::text,
    'business_verification', 'Business application updated',
    case p_status when 'approved' then 'Your business and supplier account are approved to participate in the marketplace.'
      when 'rejected' then 'Your supplier application needs changes before it can participate.'
      else 'Your supplier marketplace access has been suspended.' end,
    'business', p_business_id)
  on conflict (event_key) do nothing;
end;
$$;

revoke all on function public.admin_review_business(uuid, text, text) from public, anon;
grant execute on function public.admin_review_business(uuid, text, text) to authenticated;
