-- Repair supplier accounts approved before the account/business workflow was
-- synchronized. Existing approved businesses should grant their owner access.
update public.profiles p
set account_status = 'approved',
    account_review_note = coalesce(account_review_note, 'Approved supplier business owner'),
    account_reviewed_at = coalesce(account_reviewed_at, now()),
    updated_at = now()
where p.marketplace_role = 'supplier'
  and p.account_status = 'pending'
  and exists (
    select 1
    from public.businesses b
    where b.created_by = p.id
      and b.verification_status = 'approved'
  );
