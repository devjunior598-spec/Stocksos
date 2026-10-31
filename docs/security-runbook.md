# StockSOS security runbook

## Current protections

- Supabase Row Level Security is enabled for marketplace, account, order, support, and storage tables.
- Server actions use role and ownership checks before calling protected database functions.
- Login attempts are limited by both account and IP buckets.
- Admin routes require an approved admin profile and, after enrollment, a verified TOTP factor.
- Browser security headers are configured in `next.config.ts`.

## Required production configuration

1. Set the server-only `SUPABASE_SECRET_KEY` in Vercel. Never expose it with a `NEXT_PUBLIC_` prefix.
2. Apply `supabase/migrations/20261031020000_production_rate_limits.sql` to staging first, then production after review. The rate-limit RPC is service-role-only.
3. Sign in with the admin account and complete `/admin-mfa?setup=1` using an authenticator app. Save the recovery method in the team password manager.
4. Keep `PAYMENTS_ENABLED=false` until payment-provider review is complete.

## Staging authorization test

Run the migration suite against a disposable staging database, then run:

```sh
psql -v ON_ERROR_STOP=1 "$STAGING_DATABASE_URL" -f tests/db/authorization_matrix.sql
psql -v ON_ERROR_STOP=1 "$STAGING_DATABASE_URL" -f tests/db/sos_match_rls.sql
```

Both scripts use a transaction and roll back their fixtures. They verify buyer, supplier, admin, and unrelated-user access boundaries.

## Security test before production promotion

- Run `npm audit --omit=dev` and review every high or critical advisory.
- Run the Next.js build, typecheck, lint, and Vitest suite in CI.
- Use OWASP ZAP or an equivalent authenticated scan against the staging deployment only.
- Test registration, login lockout, MFA enrollment/challenge, buyer SOS access, supplier inventory ownership, admin-only actions, receipts, support cases, and storage paths with separate test accounts.
- Confirm no service key, payment key, OpenAI key, or cron secret appears in client bundles or repository history.
- Review Vercel and Supabase logs for unexpected 401, 403, 429, and 5xx responses.

Do not run an active scan against production without an approved maintenance window.
