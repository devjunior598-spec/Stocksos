# Supplier plan billing readiness

This implementation is a disabled, prepaid monthly checkout for supplier plan upgrades. It does not activate buyer order payments or collect charges until the separate supplier billing flags and provider account are configured.

## What is implemented

- `/pricing` suggests a display country using Vercel's country header. Visitors can change it. Where a Frankfurter reference rate exists, the page shows an **indicative** local-currency amount. It always names the actual checkout currency separately. No raw visitor IP is sent to Frankfurter.
- The approved supplier business's saved country determines billing: NG uses NGN with card or Paystack Pay with Transfer; other countries use USD card checkout after USD processing is approved. IP location never authorizes a payment method.
- An authenticated, approved business owner or business administrator can create an immutable checkout quote. No browser amount is trusted.
- A signed webhook, callback, or protected reconciliation job checks the provider reference, mode, channel, amount and currency against Paystack before recording a payment and one prepaid month. Replayed success events are idempotent.
- Supplier billing history shows verified payments and paid periods. A paid plan must be evaluated by both status and period dates; plan names alone do not grant features.

## Before enabling billing

1. Register StockSOS as the Nigerian business intended to operate the marketplace, complete Paystack's business review, and verify the corporate settlement account.
2. Choose actual NGN prices for Supplier Pro and Wholesaler Pro. The migration deliberately seeds **no** NGN price; an administrator can set one under Admin → Settings after the migration is approved and applied.
3. Confirm what each paid plan unlocks and enforce those entitlements server-side. The current plan labels and benefits are not yet a complete entitlement system.
4. Test the migration and the full card and bank-transfer flow in an isolated Supabase project with Paystack test keys. Confirm webhook delivery, callbacks, duplicate events, expired periods, refunds/disputes, and failed verification. No such end-to-end test has been performed yet.
5. Review the production migration, privacy and refund policies, and a protected Vercel preview. Obtain the existing required approvals before applying the migration or promoting code to production.
6. Configure `PAYSTACK_SUBSCRIPTION_SECRET_KEY`, `PAYSTACK_SUBSCRIPTION_WEBHOOK_SECRET`, `SUBSCRIPTION_PAYMENTS_MODE`, and `SUBSCRIPTION_PAYMENTS_ENABLED` in the intended environment. Test mode also requires a distinct `SUBSCRIPTION_TEST_PROJECT_REF` that matches the Supabase URL and is blocked in Vercel production. Live mode is blocked outside Vercel production and requires `SUBSCRIPTION_LIVE_APPROVED=true`.
7. Set `SUBSCRIPTION_USD_ENABLED=true` only after Paystack confirms USD processing and settlement for this Nigerian merchant. Without it, customers outside Nigeria can still see indicative local-currency prices but cannot start checkout.

Paystack's Nigerian merchant account supports NGN and, if approved, USD charges. It cannot charge a customer in every country's local currency. The card issuer may convert the USD or NGN charge at its own rate. Reference-rate estimates on StockSOS are never a promise of the issuer's final converted amount.
