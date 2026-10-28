-- Break the policy cycle between SOS requests and supplier matches. The helper
-- answers only whether the authenticated caller owns the specified request.
create function private.is_request_owner(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.sos_requests r
    where r.id = p_request_id and r.requester_id = auth.uid()
  );
$$;

revoke all on function private.is_request_owner(uuid) from public, anon, authenticated;
grant execute on function private.is_request_owner(uuid) to authenticated, service_role;

alter policy supplier_matches_parties_read on public.supplier_matches
  using (
    private.is_admin()
    or private.is_business_member(business_id)
    or private.is_request_owner(request_id)
  );
