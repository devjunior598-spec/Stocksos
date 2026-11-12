# StockSOS launch readiness — 2026-11-12

This is a working audit, not a legal opinion or launch approval. It records what was checked without creating production accounts, orders, payments, or database records. Production is `stocksosglobal.com`; the production Supabase project is `ikujjaducewaybslshlq`.

## Checked today

- TypeScript, the production build, and all 55 Vitest tests passed after the supplier workspace changes. ESLint found one existing image optimization warning in admin MFA, with no errors. `npm audit --omit=dev --audit-level=high` found zero reported production-dependency vulnerabilities at the time of the check. These checks do not prove the deployed database policies or full user workflows.
- Public `GET` requests returned HTTP 200 for `/`, `/pricing`, `/find-stock`, `/register`, `/terms`, and `/privacy`. An anonymous request to `/admin` returned the expected sign-in redirect (307).
- The live Privacy page still says **Draft for review** and **This draft is not in force**. The Terms page uses the same draft component.
- Vercel production configuration contains the public Supabase URL/key and a server-only Supabase secret. The variable-name listing did not include a cron secret, OpenAI credential, or subscription-payment credentials/flags. No secret values were retrieved for this audit. Presence of a variable does not prove that its value is valid.
- Recent production request records showed two HTTP 500 responses on `/become-supplier`. Redacted runtime logs identified Next.js's default 1 MB Server Action body limit rejecting a business-image upload. The application accepted up to 5 MiB, while Vercel Function requests have a 4.5 MB maximum. The code fix raises the Next.js Action limit to 4,400,000 bytes and caps the image at 4 MiB, leaving space for multipart overhead. **An authenticated supplier submission has not yet been retested in staging.**
- The supplier workspace now separates product publication from saving a private draft, hides the product creation shortcut until an approved editable business exists, and shows failed data queries as unavailable rather than zero. The interaction still needs an authenticated browser check in an isolated environment.

## Must complete before commercial launch

1. **Legal operator and policies:** Finish incorporation with counsel; confirm the exact registered name, business address, legal/privacy contact, supported launch countries, retention schedule, data-transfer terms, and dispute/refund terms. Counsel must approve the final Terms and Privacy Policy. The registration page currently says users agree to documents that the site marks as drafts; resolve that before relying on signup consent.
2. **Isolated staging:** Provision a separate Supabase project and Vercel Preview configuration. Apply migrations there in order. Run `tests/db/authorization_matrix.sql`, `tests/db/sos_match_rls.sql`, and `tests/db/rls_audit.sql` with separate buyer, supplier, admin, and unrelated-user identities. Retest registration, email confirmation, password recovery, business application with 1–4 MiB logos, product publication, SOS, quote, order, and account removal. Do not use production accounts as fixtures.
3. **Production database audit:** Reconcile migration history with the actual schema, RPCs, grants, RLS policies, and Storage policies. The 2026-11-11 audit did not find `consume_rate_limit` in production, but this was **not rechecked** today. Do not assume either that it is still absent or that it is installed. Review migrations and obtain approval before any production database change.
4. **Operational security:** Verify admin MFA enrollment and recovery, backups and a restore drill, incident response, abuse monitoring, and a staging authenticated security scan. Review authorization tests against [Supabase's RLS testing guidance](https://supabase.com/docs/guides/database/postgres/testing-row-level-security) and [OWASP ASVS](https://asvs.owasp.org/).
5. **Merchant and payments:** Keep buyer payments and supplier plan upgrades disabled. After legal registration, onboard the merchant and settlement account, choose NGN plan prices, define enforceable plan entitlements, then test card, transfer, webhook, callback, reconciliation, expiration, refunds, and disputes in isolated staging. Obtain the existing approvals before production migrations or enabling payment flags.
6. **Real marketplace pilot:** Onboard approved suppliers and accurate, in-stock products with consent. Verify an actual supplier-to-buyer journey and support response times before claiming marketplace traction. No fake production listings.
7. **Hosting plan:** Vercel's [Hobby terms](https://vercel.com/docs/plans/hobby) restrict it to personal, non-commercial use. Confirm the current team plan and move to an appropriate commercial plan before operating a revenue business. Do not purchase or upgrade without owner approval.

## Deliberately not claimed

- No production database schema or record was changed in this audit.
- No test payment, live payment, real Android-device test, email-delivery test, SMS-delivery test, or authenticated supplier submission was completed today.
- Social-platform auto-publishing and the optional AI transcription/sales assistant are not enabled by the configuration checked here.
