# StockSOS testing

## Automated checks

Run with Node.js 22+:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Current Vitest coverage exercises integer naira/kobo conversion, fee arithmetic (including pickup and rounding), and Paystack webhook HMAC verification against the exact raw request body. The SQL regression at `tests/db/sos_match_rls.sql` covers buyer, matched supplier, and unrelated-user visibility against the database.

## Completed staging run

A separate Frankfurt Supabase staging project was used for synthetic buyer, supplier, admin, and unrelated-user accounts. A pause was requested after testing; confirm the project shows Paused in Supabase before considering cleanup complete. The run verified login, supplier approval, inventory creation, product image upload and public retrieval, SOS matching and in-app notification, quotation submission, buyer acceptance, order creation, stock reservation, and cross-account access denial. Duplicate acceptance and unrelated-user storage/upload access were rejected. No production test accounts or orders were created, and payments were not enabled.

The run exposed recursive RLS checks between SOS requests and supplier matches. Migration `20261028103317_fix_sos_match_rls.sql` replaces the recursive ownership lookup with a restricted `SECURITY DEFINER` helper. It was applied to staging and the connected production schema; `tests/db/sos_match_rls.sql` was then executed against staging. The UI was also exercised in a browser through buyer SOS creation, supplier quotation, and buyer acceptance/order detail.

Email confirmation delivery, password-recovery email delivery, driver/support role scenarios, Paystack transactions, and responsive layouts beyond the phone and desktop checks remain unverified. The accounts were confirmed directly for isolated staging testing, so that run does not prove SMTP configuration or real verification links.

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

The connected Stocksos project is production. Use an isolated, paused staging project for repeat tests. The server-only Supabase secret is not configured in this workspace. Paystack checks require test keys and a reachable webhook endpoint. Use synthetic test accounts and data only.

## Phase 3 verification status

Migration `20261028124500_phase3_order_operations.sql` adds the supported payment-pending, refund, and dispute order states; buyer-only order issue requests with audit records; verified completed-order reviews; supplier payment-success notifications; and an admin-only revenue summary based on provider-verified payments. TypeScript, lint, unit tests, and a Node 22 production build pass for the application code. The migration has not been applied to production and no live payment credentials are enabled. Before release, apply it to isolated staging and test Paystack test-mode success, failure, abandonment, duplicate webhook delivery, refund handling, evidence storage permissions, review eligibility, and revenue totals.
