-- Keep account approval fields writable only through admin_review_account().
-- Replacing the table-level UPDATE grant with an explicit profile-edit allowlist
-- prevents users from changing account_status or its audit metadata themselves.

revoke update on public.profiles from public, anon, authenticated;

grant update (
  full_name,
  phone,
  home_city,
  home_country,
  home_region,
  home_postal_code,
  home_area,
  home_address,
  default_delivery_method,
  updated_at
) on public.profiles to authenticated;
