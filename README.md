# StockSOS

StockSOS is a global business inventory sourcing marketplace with U.S.-style launch defaults. Buyers can discover listed stock or send an SOS request; approved suppliers can respond with quotations and manage resulting orders. The product is built with Next.js App Router, TypeScript, and Supabase PostgreSQL/Auth/Storage.

## Repository audit and implementation checklist

The supplied `STOCKSOS` directory had no application source, `README.md`, `docs/TESTING.md`, HTML/CSS/JavaScript app, or prior Supabase schema to preserve. I created a fresh application in this directory based on the supplied product brief. The parent workspace contains unrelated projects and changes; they are outside this implementation.

- [x] Establish a Next.js 16 / React 19 TypeScript application and premium responsive StockSOS styling.
- [x] Add email/password auth, confirmation/reset callbacks, server sessions, profile onboarding, and role-gated workspaces.
- [x] Add a migration for marketplace tables, row-level security, restricted RPCs, storage buckets, seed categories/plans, and audit events.
- [x] Build buyer SOS requests, rule-based category/city/stock matching, supplier quotations, atomic quote acceptance and stock reservation.
- [x] Build public catalog and approved supplier directory, supplier inventory creation/editing, and supplier order fulfilment.
- [x] Build order detail, verified Paystack initiation/callback/webhook code, delivery partner applications and delivery status workflow.
- [x] Build admin verification/configuration tools and a separate support case workspace.
- [x] Add saved suppliers, shareable business profiles and consent-aware SOS Link enquiries.
- [x] Add unit tests for money conversion, fee calculation, and Paystack webhook signature validation.
- [x] Connect the Stocksos Supabase project, apply the core migration, and verify public category reads.
- [x] Verify the buyer-to-supplier SOS, quotation, acceptance, and order workflow in isolated Supabase staging accounts.
- [x] Fix and regression-test supplier match row-level security for request owners and matched suppliers.
- [x] Add buyer order issue/refund requests, verified completed-order reviews, and admin revenue metrics.
- [x] Add deterministic supplier match scoring, delayed SOS network expansion, and browser voice transcription with editable confirmation.
- [ ] Configure an outbound notification worker and validate email delivery.
- [ ] Complete the launch items in [Production gaps](#production-gaps) before onboarding live businesses.

## Local development

Requirements: Node.js 22 or newer and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. With no Supabase variables, public pages render real empty states and protected/database-backed features explain that setup is required. No sample supplier listings, prices, reviews, or transactions are inserted.

## Supabase setup

1. Create a Supabase project. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the server-only `SUPABASE_SECRET_KEY` in `.env.local`.
2. In Supabase Auth, enable email/password and configure the site URL plus allowed redirect URL `http://localhost:3000/auth/callback` (and the deployed equivalent).
3. Link the Supabase CLI to the project and review the SQL before applying it:

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase migration list
   supabase db push
   ```

   Apply every migration in `supabase/migrations` to staging first and verify RLS with separate buyer, supplier, and administrator accounts. The global marketplace migration introduces authoritative buyer/supplier roles, country-aware matching, and USD launch pricing.
4. To bootstrap the first administrator, use the Supabase SQL editor as the project owner and set the role for a known profile UUID:

   ```sql
   update public.profiles
   set platform_role = 'admin'
   where id = 'YOUR_AUTH_USER_UUID';
   ```

   Use `support` for a support-only operator. Do not expose role changes through client code.

## Payments

Checkout is disabled. The global launch uses USD display and storage, but no payment provider or supplier-settlement flow is enabled. Select a provider that supports every intended market, complete legal and settlement review, and test in an isolated environment before adding checkout. StockSOS must not describe a simple platform charge as escrow or a guaranteed supplier payout.

## Notifications and storage

SOS creation writes in-app notifications and deduplicated email jobs to `notification_jobs`. There is no email/WhatsApp worker in this checkout, so external messages are queued but not sent. Connect and operate a retrying background worker before promising supplier email notifications. No WhatsApp, browser push, or realtime subscription is currently wired.

The migration creates a public marketplace image bucket and private verification-document bucket. Suppliers can upload product images. Private verification document upload/review is not yet available in the admin workflow.

Vercel Hobby invokes `/api/cron/reconcile-payments` once daily. Keep the route disabled until a global payment provider is selected and its reconciliation adapter has been reviewed. Upgrade to a plan with suitable Cron frequency, or configure an equivalent authenticated scheduler, before enabling live payments.

## Deployment

`vercel.json` defines the Next.js framework, standard npm build, and payment reconciliation schedule. Import the repository into Vercel and configure the same environment variables for the right environments. Keep `PAYMENTS_ENABLED=false` until payment/settlement readiness is verified. Set a strong `CRON_SECRET`. The `.nvmrc` pins local development to Node 22. Use a separate Supabase project for preview/staging and production. Review auth redirect URLs and webhook configuration after assigning the production domain.

## Testing

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Read [docs/TESTING.md](docs/TESTING.md) for coverage and staging results. The global role/location migration and new buyer/supplier account isolation must be applied to an isolated Supabase environment before the updated end-to-end workflow can be claimed as integration-tested. Live payments remain out of scope.

## Production gaps

This is a substantial foundation, not a claim that every phase in the brief is complete. Current limits include:

- Supplier business and driver approvals work, but uploading/reading private verification documents, request-more-information, and suspension investigation workflows need a complete admin process.
- Inventory create/edit, product photo upload, public visibility, and availability work. Bulk pricing, low-stock rules, and performance analytics are not implemented.
- Supplier matching is a transparent exact-category/city/positive-stock rule. It does not use radius, response/fulfilment scores, realtime updates, AI, or external message delivery.
- SOS Link supports public profiles, a customer enquiry, business-side status updates, and explicit consent before marking a referral. It does not yet turn an enquiry into an automated network-wide sourcing request or provide referral analytics.
- The schema includes order groups for future multi-supplier fulfilment; transactions currently accept one supplier quotation for an entire request.
- Delivery is manually arranged with a city-matched partner workflow and area-level pickup/drop-off. No GPS, confirmation codes, earnings, cancellation/reassignment, dispute, or payout workflow exists.
- Configurable plan prices/benefits are displayed and editable by admins. Subscription checkout, renewal, entitlements, and backend plan restrictions are not implemented.
- Refund and dispute requests, audit records, verified buyer reviews, revenue reporting, and server-authorized PDF receipt downloads are implemented. Admin refund approval, provider refund execution, and reconciliation jobs still require staging/provider verification.
- Account deletion requests, notification preferences, email/WhatsApp/push dispatch, live database subscriptions, and StockSOS AI features are not implemented.
- The core schema and public-key connection are set up in the production Stocksos Supabase project. The global-role migration has not been applied to production. No production payment or fulfilled order was simulated.

Before launch, complete live security/RLS review, multi-jurisdiction privacy and marketplace legal review, staging tests with multiple roles, global payment and settlement review, email worker operation, error monitoring, and support/refund/dispute procedures.
