-- Phase 3: operational states, buyer protection, verified reviews, and revenue reporting.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'awaiting_payment', 'payment_pending_verification', 'paid', 'preparing',
  'ready_for_pickup', 'dispatched', 'delivered', 'completed', 'cancelled',
  'refund_pending', 'refunded', 'disputed'
));

alter table public.support_cases add column if not exists case_type text not null default 'general'
  check (case_type in ('general', 'cancellation', 'refund', 'missing_item', 'incorrect_product', 'damaged_product', 'supplier_non_fulfilment'));
alter table public.support_cases add column if not exists evidence_paths jsonb not null default '[]';

alter table public.reviews add column if not exists product_accuracy smallint check (product_accuracy between 1 and 5);
alter table public.reviews add column if not exists communication_rating smallint check (communication_rating between 1 and 5);
alter table public.reviews add column if not exists fulfilment_rating smallint check (fulfilment_rating between 1 and 5);

create or replace function public.confirm_paystack_payment(p_reference text, p_transaction_id text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  if (auth.jwt() ->> 'role') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select * into v_payment from public.payments where provider_reference = p_reference for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  if v_payment.provider_transaction_id is not null and v_payment.provider_transaction_id <> p_transaction_id then
    raise exception 'Payment transaction reference mismatch' using errcode = '22023';
  end if;
  if v_payment.status = 'succeeded' then return v_payment.order_id; end if;
  if v_payment.status <> 'pending' then raise exception 'Payment is not pending' using errcode = '22023'; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found or v_order.status <> 'awaiting_payment' or v_order.total_kobo <> v_payment.amount_kobo then
    raise exception 'Order amount or state does not match payment' using errcode = '22023';
  end if;
  update public.payments set status = 'succeeded', provider_transaction_id = p_transaction_id,
    verified_at = now(), updated_at = now() where id = v_payment.id;
  update public.orders set status = 'paid', paid_at = now(), updated_at = now() where id = v_order.id;
  update public.order_groups set status = 'paid', updated_at = now() where id = v_order.group_id;
  update public.stock_reservations set status = 'committed' where order_id = v_order.id and status = 'held';
  update public.inventory i set quantity_reserved = quantity_reserved - r.quantity, updated_at = now()
    from public.stock_reservations r where r.order_id = v_order.id and r.product_id = i.product_id and r.status = 'committed';
  insert into public.notifications (user_id, event_key, kind, title, body, entity_type, entity_id)
  values
    (v_order.buyer_id, 'payment:' || v_payment.id::text || ':succeeded:buyer', 'payment_succeeded',
      'Payment confirmed', 'Your payment was verified. The supplier can now prepare your order.', 'order', v_order.id),
    ((select q.supplier_user_id from public.quotations q where q.id = v_order.quotation_id),
      'payment:' || v_payment.id::text || ':succeeded:supplier', 'payment_succeeded',
      'Order payment confirmed', 'Prepare the buyer’s paid order in your supplier workspace.', 'order', v_order.id)
  on conflict (event_key) do nothing;
  return v_order.id;
end;
$$;

create or replace function public.create_order_dispute(
  p_order_id uuid, p_case_type text, p_message text, p_evidence_paths jsonb default '[]'
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_case_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_case_type not in ('cancellation', 'refund', 'missing_item', 'incorrect_product', 'damaged_product', 'supplier_non_fulfilment')
    or length(trim(coalesce(p_message, ''))) not between 10 and 5000
    or jsonb_typeof(coalesce(p_evidence_paths, '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid case details' using errcode = '22023';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.buyer_id <> auth.uid() then raise exception 'Order not found' using errcode = '42501'; end if;
  if v_order.status in ('cancelled', 'refunded') then raise exception 'This order cannot be disputed' using errcode = '22023'; end if;
  insert into public.support_cases (user_id, order_id, subject, message, case_type, evidence_paths)
    values (auth.uid(), v_order.id, initcap(replace(p_case_type, '_', ' ')), trim(p_message), p_case_type, p_evidence_paths)
    returning id into v_case_id;
  if p_case_type in ('refund', 'missing_item', 'incorrect_product', 'damaged_product', 'supplier_non_fulfilment') then
    update public.orders set status = 'disputed', updated_at = now() where id = v_order.id
      and status not in ('completed', 'cancelled', 'refunded');
  end if;
  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'order_dispute_created', 'support_case', v_case_id,
      jsonb_build_object('order_id', v_order.id, 'case_type', p_case_type));
  return v_case_id;
end;
$$;

create or replace function public.create_order_review(
  p_order_id uuid, p_product_accuracy smallint, p_communication smallint,
  p_fulfilment smallint, p_comment text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_review_id uuid;
  v_overall smallint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_product_accuracy not between 1 and 5 or p_communication not between 1 and 5 or p_fulfilment not between 1 and 5
    or length(coalesce(p_comment, '')) > 1000 then raise exception 'Invalid review' using errcode = '22023'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.buyer_id <> auth.uid() or v_order.status <> 'completed' then
    raise exception 'Only the buyer of a completed order can review it' using errcode = '42501';
  end if;
  v_overall := round((p_product_accuracy + p_communication + p_fulfilment)::numeric / 3)::smallint;
  insert into public.reviews (order_id, buyer_id, business_id, rating, comment, product_accuracy, communication_rating, fulfilment_rating)
    values (v_order.id, auth.uid(), v_order.business_id, v_overall, nullif(trim(p_comment), ''), p_product_accuracy, p_communication, p_fulfilment)
    returning id into v_review_id;
  insert into public.audit_logs (actor_id, action, target_type, target_id)
    values (auth.uid(), 'order_review_created', 'review', v_review_id);
  return v_review_id;
end;
$$;

create or replace function public.admin_revenue_summary(p_since timestamptz default now() - interval '30 days')
returns table (
  successful_transactions bigint, gross_transaction_value_kobo bigint,
  platform_fees_earned_kobo bigint, refunded_platform_fees_kobo bigint,
  net_platform_revenue_kobo bigint, pending_orders bigint, failed_payments bigint,
  active_suppliers bigint, active_buyers bigint, completion_rate numeric
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
  with completed as (
    select o.* from public.orders o where o.paid_at >= p_since and o.status in ('paid','preparing','ready_for_pickup','dispatched','delivered','completed','disputed','refund_pending','refunded')
  ), totals as (
    select count(*)::bigint transactions, coalesce(sum(total_kobo),0)::bigint gtv, coalesce(sum(platform_fee_kobo),0)::bigint fees from completed
  ), refund_fees as (
    select coalesce(sum(o.platform_fee_kobo),0)::bigint fees from public.orders o where o.status = 'refunded' and o.updated_at >= p_since
  ), order_counts as (
    select count(*) filter (where status = 'completed')::numeric completed, count(*)::numeric all_orders from public.orders where created_at >= p_since
  )
  select t.transactions, t.gtv, t.fees, rf.fees, (t.fees-rf.fees),
    (select count(*)::bigint from public.orders where status in ('awaiting_payment','payment_pending_verification','paid','preparing','ready_for_pickup','dispatched','delivered')),
    (select count(*)::bigint from public.payments where status = 'failed' and created_at >= p_since),
    (select count(*)::bigint from public.businesses where verification_status = 'approved'),
    (select count(distinct buyer_id)::bigint from public.orders where created_at >= p_since),
    case when oc.all_orders = 0 then 0 else round(100 * oc.completed / oc.all_orders, 2) end
  from totals t cross join refund_fees rf cross join order_counts oc;
end;
$$;

revoke all on function public.create_order_dispute(uuid, text, text, jsonb) from public, anon;
revoke all on function public.create_order_review(uuid, smallint, smallint, smallint, text) from public, anon;
revoke all on function public.admin_revenue_summary(timestamptz) from public, anon;
grant execute on function public.create_order_dispute(uuid, text, text, jsonb) to authenticated;
grant execute on function public.create_order_review(uuid, smallint, smallint, smallint, text) to authenticated;
grant execute on function public.admin_revenue_summary(timestamptz) to authenticated;
