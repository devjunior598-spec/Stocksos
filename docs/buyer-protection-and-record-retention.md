# Buyer protection and retained records

Status: implementation draft. Live payments remain disabled.

## Current purchase path

An approved supplier publishes a product. A buyer can now start SOS from that product page; the request keeps the listing context and explicitly notifies that supplier, including when the buyer is in a different city. The buyer receives a quotation, accepts it, and an order is created with `awaiting_payment`. The payment initializer deliberately returns 503. No buyer should be instructed to pay a supplier directly through StockSOS while this is disabled.

## Required payment flow

1. Establish StockSOS's legal operator and payment-provider account. Confirm the provider supports the platform's incorporation country, target buyer countries, supplier countries, settlement currencies, delayed transfers, refunds, and disputes. Do not market this as regulated escrow unless counsel and the provider confirm it.
2. On accepting a quote, lock the server-calculated order amount, currency, supplier, quantity and fulfilment terms. Never trust a price or payee supplied by the browser.
3. Create a hosted checkout session on the platform account. The buyer enters card details only on the provider's page. Store a provider reference and non-sensitive payment status, never card numbers or CVV.
4. Mark the order paid only after a signature-verified webhook **and** an independent provider retrieval confirm the order ID, amount and currency. Make event processing idempotent.
5. Keep supplier proceeds in a platform-controlled balance using a provider-supported separate charge and transfer flow. Do not automatically split or transfer payment to the supplier at checkout. Confirm the legal and regulatory treatment of held funds in each launch market.
6. Require fulfilment evidence. Release a supplier transfer after verified delivery and a documented buyer review window, unless a dispute or fraud hold is open. Admin overrides require MFA, a reason, and an audit event. Never let the supplier trigger their own payout.
7. Support partial/full refunds, chargebacks, cancelled orders, failed transfers, and reconciliation. Record each movement in an append-only ledger with provider IDs and idempotency keys.
8. Test failed webhooks, duplicate events, currency mismatch, payment success after order expiry, supplier non-delivery, refund races, and attempted cross-account checkout before enabling production.

The existing Paystack split payment feature automatically shares a settlement; it does not provide a delivery-conditioned hold. The existing payment RPCs and order status model are insufficient to promise protected payouts worldwide. They must remain gated until a provider and legal terms are approved.

Provider references: [Stripe separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers.md?platform=web&integration=checkout&ui=stripe-hosted), [Stripe cross-border payouts](https://docs.stripe.com/connect/connect-cross-border-payouts), and [Paystack split payments](https://paystack.com/docs/payments/split-payments/). Stripe's platform charges and later transfers can support a hold-and-release workflow in eligible markets, but platform eligibility, chargeback responsibility and legal treatment must be confirmed. Paystack's split settlement should not be presented as buyer-protection holding.

## Removal and evidence retention

The accompanying migration adds `removed_at`, `removed_by`, and reason fields to profiles and products, plus restricted pre-change snapshots of profiles, businesses and listings. Removal hides supplier businesses and products, blocks new marketplace writes from removed users, and preserves order, dispute and audit records. The app copies listing photos, videos and business logos to a private Supabase Storage bucket before deleting public copies that are no longer used by another live listing. Administrators with MFA can inspect the retained records and files from the dashboard. A removal is an access change, not a hard Auth-user deletion. Account removal is blocked if another active owner shares one of the account's businesses; transfer ownership first. The current synchronous removal action stops at 200 products so a large account is not partially archived by a timed-out request.

The operator must adopt a retention schedule before production use. Keep only data needed for open disputes, fraud investigations, chargebacks, tax/accounting duties or legal claims. Define routine deletion periods, legal holds, access review, export/erasure handling and backup expiry with counsel. Do not retain passwords, card data, or unnecessary identity documents. If a user requests erasure, review applicable legal obligations and claims rather than promising indefinite retention or automatic full deletion.

The history trigger begins recording when the migration is applied. It cannot reconstruct edits made before that date or historical email changes in Supabase Auth. The admin archive pages through removed accounts, products, business logos and matching history in groups of 50. Administrators can look up a known account, product or business ID directly. The archive does not provide broad text search or bulk export.

## Rollout gates

- The migration was applied to an isolated PGlite fixture on 2026-11-02. Fixture checks passed for supplier removal, outsider denial, admin-only account removal and archive reads, retained profile/product history, private bucket configuration, selected-supplier matching, notification cleanup, and stale-product SOS rejection. A read-only production schema check found the expected predecessor migrations, tables and columns. This is a SQL fixture check, not a hosted Supabase Auth or Storage test.
- Apply `20261102091122_retain_removed_marketplace_records.sql` to a nonproduction Supabase project; test owner/admin/other-user RLS, Auth banning and Storage copy/deletion with separate accounts. A temporary Supabase branch could not be created on the current plan, so this end-to-end database test remains outstanding.
- Verify that a product-page SOS notifies only the selected supplier, including when the buyer lives in another city, and that a stale or out-of-stock listing fails without creating a request.
- Reconcile existing products with missing or invalid media paths; the archive action intentionally fails closed when evidence cannot be copied.
- Review this retention design with counsel and publish updated privacy/terms language before enabling removal.
- Apply the migration to production only after explicit approval and a backup. Deploy the matching application code in the same release window.
- Select a provider and jurisdiction, then implement and test the payment ledger, hosted checkout, payout holds and refund controls. Leave `PAYMENTS_ENABLED` disabled until those tests pass.
