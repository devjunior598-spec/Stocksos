# StockSOS testing

## Automated checks

Run with Node.js 22+:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Current Vitest coverage exercises integer naira/kobo conversion, fee arithmetic (including pickup and rounding), and Paystack webhook HMAC verification against the exact raw request body. It does not replace database or provider integration tests.

## Staging test matrix

Before production, create separate accounts for each role and verify:

- Email confirmation, sign-in, reset, session refresh, logout, and protected-route redirects.
- A pending supplier cannot publish public stock or quote; after approval it can create/edit stock and quote only on a matching open request.
- Private product/inventory rows and private verification documents are not readable to other accounts or anonymous clients.
- Buyers can see only their own requests, quotations, orders, payments, notifications, and support cases.
- A buyer cannot accept another buyer's quote; acceptance races create one order and reserve inventory once.
- Insufficient stock, expired quotations, cancelled requests, incompatible delivery, and repeated quote acceptance fail safely.
- Only a verified supplier member advances order preparation; only an approved delivery partner in the matching city can accept a delivery job.
- Only the buyer confirms receipt; support/admin permissions do not expose unrelated account/order data.
- Admin approvals, plan changes, platform-fee changes, and support status changes are recorded in `audit_logs`.
- Paystack test transactions verify exact reference, amount, currency, and provider status; repeated webhooks are idempotent; bad signatures, wrong amounts, failed transactions, and mismatched references do not mark orders paid.
- The mobile navigation, forms, keyboard focus, errors, empty states, order table overflow, and support content work at phone and desktop widths.

The core migration is applied to the connected Stocksos Supabase project, and a public-key API smoke test returned the seeded categories. This does not verify sign-in or role-specific RLS: use separate synthetic buyer, supplier, driver, support, and admin accounts in staging. The server-only Supabase secret is not configured in this workspace. Paystack checks require test keys and a reachable webhook endpoint. Use synthetic test accounts and data only.
