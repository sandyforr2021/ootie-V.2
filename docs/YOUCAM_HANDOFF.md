# OOTIE × YouCam: implementation and database handoff

Verified on 2026-10-22. This file describes this checkout, not a deployed release.

## Database separation

OOTIE uses `OOTIE-personal-dev`, project `hoxkrmadzjnyjaqjbyxc`, on Supabase Free. It was resumed successfully and reported Healthy. The unrelated Nature & Sound drumstand project (`iaswunanvtuwgmxpdbdd`) remained Healthy and was not modified. Do not reuse its connection URL, keys, tables or storage.

The frontend and gateway reject a hostname that differs from the configured OOTIE project reference. Local frontend settings are in ignored `.env.local`; server credentials are in ignored `gateway/.env.local`. Only the publishable key belongs in the frontend. Existing keys were used; no Supabase keys were created or revoked.

Migration `supabase/migrations/20261022103816_youcam_commerce_jobs.sql` was applied once through OOTIE's SQL Editor. All six new tables were verified with row-level security enabled:

- `ootie_shop_products`: private product shortlist and retailer URL.
- `ootie_youcam_budget`: server-only free-unit allocation, initially locked at zero.
- `ootie_youcam_batches`: idempotent submissions.
- `ootie_youcam_jobs`: persistent queue, leases and provider task IDs.
- `ootie_shop_posts`: explicitly published result projections.
- `ootie_commerce_events`: actual link-click and share actions.

The original tables were preserved. `ootie-ai-private` and `ootie-closet-media` remain private. The new `ootie-shop-shares` bucket holds only derivatives explicitly published by their owner; it is currently empty. Originals are never automatically copied there.

**Migration history:** SQL Editor execution does not register this file in the Supabase CLI migration history. Inspect both remote schema and history before any `db push` or migration repair. Do not rerun this non-idempotent migration or reset/reseed this database.

## Run this checkout

Install the checked-in dependencies with `npm ci` and `npm ci --prefix gateway`. Obtain existing keys from the project owner; never paste them into a commit, browser console, screenshot or issue. The example files document variable names.

```powershell
node --env-file=gateway/.env.local gateway/src/server.js
# In a separate terminal:
npm run dev -- --host 127.0.0.1
# Read-only database verification:
node --env-file=gateway/.env.local scripts/check-youcam-database.mjs
```

Open `http://127.0.0.1:5173/shop`. The new shopping flow offers English (default), Traditional Chinese, Japanese and Spanish. User-authored content is preserved. Translation work on older secondary screens remains incomplete.

The gateway must run continuously to process queued jobs. Closing the browser does not cancel a submitted job; stopping the gateway pauses processing. Do not assume a request-only host will run a background worker while idle. A deployment plan covering the judging period is still required. Existing Cloud Run URLs currently serve the previous version.

## Free-credit controls

The account holder completed API-key creation. The key is stored only in ignored gateway/.env.local. Read-only console/API checks during this session showed 1,000 hackathon gift units plus 40 API-key gift units, zero usage, no paid balance and auto top-up off. No live generation has been submitted.

The 1,000-unit gift batch expires 2027-01-20 23:59:59 UTC; the 40-unit gift batch expires 2027-10-22 23:59:59 UTC. The console reports key expiry on 2026-12-21. Current checked costs are 2 units per clothing try-on and 20 per skin-tone analysis. The gateway is enabled with a 100-unit internal allocation and zero units allocated to jobs. Its local budget expires conservatively on 2026-12-20 16:00:00 UTC.

Before each provider submission, the server reads balance and feature cost, identifies the 1,000-unit gift batch by expiry, and fails closed when the free batch cannot cover the operation. This avoids silently relying on a paid balance or an unknown price. Never enable automatic top-up or purchase credits under the current brief.

The browser still requires an explicit photo choice and consent for each processing request. Public sharing is a separate action. AI images illustrate appearance, not clothing size or fit; color ideas are not a medical or seasonal color diagnosis.

## Real functionality and honest evidence

The original database contains seeded profiles, outfit posts, likes and demonstration generation history. These counts are **not** evidence of actual customers, YouCam usage, sales or growth. The live frontend now excludes known seeded rows and their references using exact fixture IDs, media provenance and metadata. Empty authoritative responses clear stale activity. New visitor state has no prefilled identity, wardrobe, notifications or bookmarks. Stored seed records have not been deleted. Never relabel fixture content as real user activity. Do not run `seed:demo` during verification: it can reset demo identities and fabricate demonstration activity.

The new commerce tables start empty. Activity metrics use actual new products, completed YouCam jobs and tracked user actions. Link clicks are not completed orders; no revenue, returns or conversion lift is measured. Counts are limited to the latest 200 products/jobs and 1,000 actions per user.

Official rules require a working YouCam integration, a coherent experience, truthful descriptions and consumer/eCommerce value. They do not require a payment gateway or existing revenue. A final demo must show real functioning behavior, disclose the pre-existing OOTIE base and explain substantial additions during the submission period. Provide English submission materials and free judge access through the end of judging.

Sources: [official rules](https://youcam-api-skin-ai-ecommerce.devpost.com/rules), [starter resources](https://youcam-api-skin-ai-ecommerce.devpost.com/resources), [YouCam quick start](https://docs.perfectcorp.com/develop/quick_start_guide).

## Commercial direction

The initial paying customer is an online fashion merchant. The proposed service helps a shopper evaluate a product on their own photo, compare it with owned clothing and return to the merchant's product page. The existing retailer handles checkout.

Prioritize merchant trial/service fees based on successful try-ons, with an agreed usage cap. Add affiliate commission only for merchants with an actual affiliate agreement and verified order attribution. A link-click counter alone cannot substantiate commission. Consumer subscriptions remain a later hypothesis.

Measure import success, try-on completion/time, wardrobe pairings and product-link clicks during consenting team tests. Future merchant experiments should compare the same traffic groups and confirm completed orders through merchant records. Do not claim reduced returns or increased sales before measurement. Pricing must cover production API units, hosting, failed-request policy and support; hackathon gift units are not a permanent business subsidy.

## Verification and outstanding work

Current verification: 298 frontend tests across 69 files and 52 gateway tests passed on 2026-10-22. The production build succeeded with one large-chunk warning. A live read-only check confirmed all six new tables are reachable, anonymous direct reads are denied, and all new commerce records remain empty except the internal budget row. Browser checks verified English, Traditional Chinese, Japanese and Spanish shopping labels, consent text and document titles. The current source of outstanding work is [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md).

Automated checks cover isolated PostgreSQL RLS/ownership, atomic budget reservation, concurrent queue claims, idempotency, cancellation, uncertain submissions, private result storage, safe downloads, locale switching and project boundaries. They use test fixtures and do not spend YouCam units.

Still required before describing this as a finished submission: a real, consented try-on and skin-tone test; the complete cross-page shopping and community flow; remaining secondary-page translations; deployment/worker availability through judging; asset-license evidence for public promotional use; and an English functioning demo matching the final submission requirements. A real jury account and eight source-backed private wardrobe items are prepared; credentials are kept in the ignored JUDGE_ACCESS.local.md. Remote jury access is pending deployment.

## UI system and evidence

The user's approved direction is joyful, colorful high fashion using berry, butter yellow, mint and lilac. The opening wardrobe-door animation is preserved, with a replay control and reduced-motion support. The shopping flow uses three steps, with photo consent and sufficient-credit checks before queue submission. English is the initial language; saved preferences remain respected. CJK display type is upright, with separate size, line-height and spacing rules; Spanish controls wrap. No paid assets or generated media were purchased for this revision.

Sources of UI truth: PRODUCT.md, DESIGN.md, src/assets/atelier.css and src/assets/shop-studio.css. The review folder contains actual browser captures and offline test results. The source detector was run once and returned no findings. The production build succeeds with the existing main-chunk size warning; no live paid/gift-unit generation was used for UI verification.
