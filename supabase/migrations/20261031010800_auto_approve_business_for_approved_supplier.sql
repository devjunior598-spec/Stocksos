-- Admin account approval is the supplier verification gate. A supplier whose
-- account is already approved should not need a second review for each business.
create or replace function public.create_business_application(
  p_name text, p_slug text, p_category_id uuid, p_country text, p_region text,
  p_city text, p_postal_code text default null, p_area text default null,
  p_phone text default null, p_email text default null, p_description text default null,
  p_registration_number text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_business_id uuid;
  v_user_id uuid := auth.uid();
  v_account_status text;
  v_verification_status text;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select p.account_status into v_account_status
    from public.profiles p
    where p.id = v_user_id and p.marketplace_role = 'supplier';
  if not found then raise exception 'A supplier account is required' using errcode = '42501'; end if;
  if v_account_status <> 'approved' then
    raise exception 'Supplier account approval is required before submitting a business' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 120
    or length(trim(coalesce(p_city, ''))) not between 2 and 100
    or length(trim(coalesce(p_region, ''))) not between 2 and 100
    or upper(trim(coalesce(p_country, ''))) !~ '^[A-Z]{2}$'
    or coalesce(p_slug, '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Invalid business details' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories c where c.id = p_category_id and c.is_active) then
    raise exception 'Select an active business category' using errcode = '22023';
  end if;
  v_verification_status := 'approved';
  insert into public.businesses (
    name, slug, primary_category_id, country, region, city, postal_code, area,
    phone, email, description, registration_number, created_by,
    verification_status, visibility
  ) values (
    trim(p_name), lower(trim(p_slug)), p_category_id, upper(trim(p_country)), trim(p_region),
    trim(p_city), nullif(trim(p_postal_code), ''), nullif(trim(p_area), ''),
    nullif(trim(p_phone), ''), nullif(lower(trim(p_email)), ''),
    nullif(trim(p_description), ''), nullif(trim(p_registration_number), ''), v_user_id,
    v_verification_status, 'public'
  ) returning id into v_business_id;
  insert into public.business_memberships (business_id, user_id, role)
    values (v_business_id, v_user_id, 'owner');
  insert into public.audit_logs (actor_id, action, target_type, target_id)
    values (v_user_id, 'business_application_created_and_approved', 'business', v_business_id);
  return v_business_id;
end;
$$;
