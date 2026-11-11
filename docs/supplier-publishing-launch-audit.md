# Supplier publishing launch audit

Date: 2026-11-11. Scope: supplier marketplace product creation, editing, media, discovery, and removal.

## Verified in code and read-only production checks

- The new-listing form includes business, category, product name, brand, SKU, unit price, stock quantity, selling unit, minimum order, lead time, condition, public/private visibility, photos, video, and description/specifications.
- Production has 31 active categories and a public `marketplace-images` bucket configured for JPEG, PNG, WebP, MP4, and WebM, with a 50 MB bucket limit. The form imposes 10 MB per photo and 50 MB per video.
- Production currently has zero businesses and zero products. No supplier publish or buyer discovery transaction was performed against production.
- Product creation uses the `create_supplier_product` RPC. It checks approved business membership and active categories. The client attaches media through product row update under RLS.
- Public search requires an active public product, approved public business, and stock. This change also excludes zero-priced items and listings without a cover photo.

## Fixed in this branch

- Public creation and active public edits now require a cover photo, positive unit price, and available stock. Private or hidden drafts can still have zero price or stock.
- New products remain private until the media paths and public visibility are written together. If the media write fails, the product remains a private draft and the supplier sees the problem.
- Creation errors are displayed on the form without redirecting away and losing typed information.
- Photo uploads enforce the advertised maximum of 10 photos and one video on both client and server.
- The server verifies that submitted photo and video paths exist in Storage before saving them to a listing.
- Category and business loading failures, and product-list loading failures, are displayed as errors rather than empty states.
- The mobile action bar no longer sticks over form fields or the on-screen keyboard.
- The product list distinguishes published listings from private drafts and counts only listings with photo, positive price, and stock.
- The supplier removal control is withheld when the archive schema is unavailable, with instructions to hide the product and contact support.

## Launch blockers and limits

1. **Supplier product removal is not live.** Production lacks `products.removed_at` and the `remove_supplier_product` RPC. The existing retention migration is broad and also changes account removal, RLS, history, evidence storage, and SOS behavior. It needs isolated database testing and explicit production approval before application.
2. **Authenticated end-to-end publish is unverified.** There are no production supplier/product records, and no test accounts were created on production. Supabase refused a temporary preview branch because branching is limited to Pro plans. Test a separate staging project or plan upgrade before claiming the full supplier-to-buyer flow works.
3. **Editing remains compact and limited.** The current edit form updates core stock, price, condition, visibility, specifications, and media. Category and the creation-only optional fields are not separate edit controls; suppliers can update the latter in specifications. A dedicated full edit page is a follow-up usability improvement.
4. **Currency is USD only** in the current product workflow. Additional currencies require coordinated database and payment/search changes.

## Validation

- `npm run typecheck`: passed.
- `npm test`: 33 tests passed, including new publication and media-boundary tests.
- `npm run build`: passed. The final Vercel preview build also passed.
- Vercel preview: https://socksos-nmjtcnzym-junior-dev4.vercel.app/ (requires Vercel authentication).
- Real authenticated supplier publishing, media upload, buyer search, and mobile device use: not performed.

No production database records or schema were changed during this audit.
