# StockSOS launch gate — 2026-11-11

This is an evidence record, not a launch approval. The production website is `stocksosglobal.com`; the Supabase production project is `ikujjaducewaybslshlq`.

## Verified in this review

- The application typecheck, 39 Vitest tests, lint, and Next.js production build passed locally. Lint has one existing image optimization warning in admin MFA enrollment.
- `npm audit --omit=dev --audit-level=high` reported zero vulnerabilities at the time of the check.
- A read-only production catalog query found RLS enabled on all 30 public tables. This does not test the content or behavior of those policies.
- A read-only production function query found `public.consume_login_attempt`, but **did not find** `public.consume_rate_limit`.
- Production has the `private` and `extensions` schemas and `pgcrypto` in `extensions`, which the rate-limit migration expects.
- Future Vercel Preview and Development deployments no longer have the production Supabase URL or publishable key. Production environment variables were unchanged. Existing deployments are immutable and may retain their original configuration.

## Release blockers

1. Apply and test `supabase/migrations/20261031020000_production_rate_limits.sql` in an isolated staging database. Verify the service role can call the function and anon/authenticated roles cannot. Review and obtain approval before applying it to production. The fail-closed application change must not reach production first: registration, search, support, and transcription would become unavailable.
2. Configure a separate Supabase staging project and Vercel Preview environment. Run account, SOS, quotation, inventory, admin, storage, and RLS authorization tests there. Do not create test accounts or orders in production.
3. Run an authenticated staging security scan and verify backup/restore procedures before promotion.
4. Resolve migration-history drift between the repository and production before further database deployments. A migration ID mismatch is not evidence that its schema is absent; inspect the actual catalog and functions.
5. Have counsel finalize the public Terms and Privacy Policy. The operator is not yet registered; legal entity, jurisdiction, address, legal/privacy contact, retention schedule, and cross-border data terms are not confirmed. Keep current policy text marked as draft.
6. Verify the admin account's MFA enrollment, the notification worker, and payment-provider readiness separately. Payments and autonomous assistant billing remain disabled until their required reviews and configurations are complete.

## Release order

Staging database and environment → staging migration and authorization tests → approved production migration → verify production RPC and grants → production code promotion → monitor 4xx/5xx and rate-limit logs. Do not swap the database and code steps.
