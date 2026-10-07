# OOTIE Development Demo Handoff — 2026-10-01

## Outcome

The presentation-ready Development Demo is complete on top of the verified remote integration. `OOTIE-personal-dev` now has migrations 001–025, a reusable populated seed, a dedicated presenter account, distinct Guest/Member homes, recent Trending, internal Development plans/credits, birthday points, points-aware AI generation, remote social state and product import. Cloud Run remains Development-only. Production was not deployed or changed.

## Main entry points

- Frontend AI Styling: `src/views/AiView.vue`
- Frontend image modes: `src/views/TryonView.vue`
- Browser Gateway adapter: `src/services/aiGateway.js`
- Central image preprocessing: `src/services/imageUpload.js`
- Gateway server: `gateway/src/server.js`
- Provider contract/adapters: `gateway/src/providers/`
- Auth/Storage/ledger service: `gateway/src/services/`
- Canonical migrations: `supabase/personal_baseline/001_*.sql` through `025_*.sql`
- Demo seed: `scripts/seed-demo-data.mjs`
- Local credentials handoff: `DEMO_ACCOUNT.local.md` (gitignored)
- Demo behavior: `DEMO_ACCOUNT.md`, `DEMO_SEED_DATA.md`, `SUBSCRIPTION_DEMO.md`
- Cloud preflight: `GOOGLE_CLOUD_AI_SETUP.md`

## Local verification

```text
npm test
  Vitest: 55 files / 226 tests PASS
  Supabase isolation + seed contract: 6/6 PASS
  Gateway: 19/19 PASS
  Complete schema validator chain: PASS

npm run build
  PASS; initial JS is 487.15 kB / 155.10 kB gzip after route lazy loading
```

Tests mock every external network call. They verify guest denial, member route access, cross-owner item denial, duplicate ID behavior, daily quota, kill switch, provider error, safety rejection, Storage result write, DB path-only persistence, logout denial, VTO one-image request and outfit-preview 1K output.

## Database/migration summary

Migration 016 creates:

- `public.ootie_ai_generations`
- own-row authenticated SELECT RLS; no browser insert/update/delete grant
- private `ootie-ai-private` bucket
- own-path authenticated Storage SELECT; no browser write policy
- `claim_ootie_ai_generation()` with per-user/day advisory lock, quota and idempotency
- execute permission for `service_role` only

001–025 were applied in numeric order to `OOTIE-personal-dev` (`hoxkrmadzjnyjaqjbyxc`). Migrations 022–025 add remote follows and notification triggers, external-product attribution, private weather city, the narrow social service-role grant, a restricted RLS helper boundary and two Advisor-requested foreign-key indexes.

Migration 018 removed broad public-bucket listing policies. Migration 019 added authenticated owner-only SELECT required for owner replace/delete. Bookmark, Avatar and OOTD smoke verified public URL read, owner replace/delete, empty anonymous/cross-member listings, cross-member replace denial and cross-member delete no-op. Security Advisor is 0 errors / 3 warnings: two platform-managed `rls_auto_enable()` execute findings and Auth leaked-password protection disabled. Performance Advisor is 0 errors / 0 warnings / 12 info.

## Remote AI smoke

- VTO generation `8c98834d-2ef5-4e55-aeba-cceb7c0c0ade`: `virtual-try-on-001`, Singapore, `sampleCount=1`, one PNG result, private Storage and ledger succeeded. Reusing the generation ID returned the existing result without a second provider call.
- Outfit preview `2e331a97-adc8-42a4-8ad0-1be947ab1c5a`: `gemini-3.1-flash-image`, global, 1K, one PNG result, private Storage and ledger succeeded.
- Owner result reads returned 200; cross-member reads returned 403; signed-out reads returned 401.
- Exactly two paid provider requests were made. Ledger estimate is US$0.13 plus small input-token cost; Billing Credits still showed TWD 9,448.92 immediately afterward, so the per-request line-item delta had not yet posted.

## Local repository notes

- The obsolete browser provider service was removed; package dependencies did not include its SDK.
- The pre-existing untracked `OOTIE_SUPABASE_BATCH_003_012_SAFE/` and `supabase/personal_baseline.rar` were preserved and not modified as part of this Batch.
- Root `.env` was not read beyond variable names and was not modified.
- Build output `dist/` remains ignored.

## Demo dataset and live walkthrough

- Presenter account: 42 owned closet items, private person photo, private AI history, PLUS and 245 points.
- Community: 12 profiles, 36 OOTDs, 170 likes, 12 SOS posts and 18 suggestions.
- Guest Home → Explore → OOTD detail and Member Home → Closet → AI → Try-On → Explore → SOS → Profile → Membership were exercised.
- OOTD like/unlike and save/unsave passed remotely and the seeded rows were restored.
- 1440, 1024, 768 and 390 widths passed without horizontal page overflow or broken loaded images after the main flex-width fix.
- One Development Gemini text styling request was made in this sprint; no new VTO or image-preview request was made.

## Known limitations

- Cloud Billing usage/credit reporting is delayed; the immediate console balance did not yet show the two requests as a separate posted delta.
- Security Advisor is 0 errors / 5 warnings: four intentional authenticated subscription/points RPCs and leaked-password protection, which is unavailable on the current Free plan. Performance Advisor is 0 errors / 0 warnings; its remaining 9 info items are unused-index signals retained until representative workload exists.
- Model launch stage and lifecycle must be rechecked before any Production decision.
- Clothing AI input supports existing owned inline image data or Supabase Storage URLs; arbitrary external clothing URLs are intentionally rejected to prevent SSRF.
- Private person photos can now be deleted from Try-on. The Gateway derives the owner from the verified Supabase JWT, resolves the exact owned Storage path, and deletes through the Storage API; the browser cannot submit another user's path.
- Existing WebP clothing display images are converted in memory to a validated JPEG AI derivative before Google requests. The stored original/display media is not overwritten, and an invalid garment error identifies the affected closet item.
- Try-on now keeps the paid modes explicit: Virtual Try-On accepts exactly one garment, while AI Outfit Preview accepts 1–5 garments with a selected-item tray and visible count.
- Demo subscription is intentionally simulation-only and must not be presented as payment.
- Generated result can be marked saved, but publishing remains a separate explicit OOTD action.
- Cloud Run request duration depends on provider latency; UI times out without retry to prevent duplicate charges.
- Statistics remains a separate 222.90 kB lazy chunk; no route chunk exceeds 500 kB.

## Feature Completion Phase 3

- Follow/unfollow, counts and notification read state are Supabase-backed and survive logout/login. Database constraints and RLS prevent self-follow, duplicate follow and cross-owner writes.
- External inspiration uses an authenticated Cloud Run parser with JSON-LD Product → OpenGraph → page metadata → manual fallback. Only the explicit purchased action creates a closet item and keeps source attribution.
- Weather handles location success, denial, unavailable, provider failure, manual city and private saved city without fabricated values.
- Google OAuth frontend/bootstrap and local redirect allowlists are ready. The Google provider remains disabled until a Google OAuth client is explicitly created and connected.
- Playwright covers guest login entry, the member journey, remote social persistence/notifications and external product conversion.

## Development Preview and Google OAuth

- Preview URL: `https://ootie-web-dev-s5nwal7adq-as.a.run.app`
- Preview Cloud Run service: `ootie-web-dev`, `asia-southeast1`, request-based scaling with `min=0` and `max=3`.
- OAuth-only project: `ootie-oauth-dev-514646` (`OOTIE OAuth Development`), project number `6632540867`, Billing disabled.
- OAuth client: `OOTIE Development Web`; allowed origins are the Preview origin and local port 5174 origins. Redirect URI is the Supabase callback for `hoxkrmadzjnyjaqjbyxc`.
- Supabase Google provider is enabled. Site URL is the Preview origin; both Cloud Run URL forms and both local port 5174 URLs remain in the redirect allowlist.
- AI, Vertex, VTO, Nano Banana and `ootie-ai-gateway-dev` remain in `ferrous-phoenix-16888`. Gateway CORS accepts the exact Preview origins and rejects unlisted origins.
- Live smoke passed for Google login, protected-route return, one-profile bootstrap and logout. No OAuth secret is stored in Git, documentation, frontend environment variables or the browser bundle.
- The existing `n8n x GCP` brand in `ferrous-phoenix-16888` was not modified.

## Next exact action

Use `DEMO_ACCOUNT.local.md` for the presentation login and follow the walkthrough in `DEMO_SEED_DATA.md`. Keep Development quota at 3. Do not promote the seed grants, simulated plan system, Preview service, OAuth client or Cloud Run service to Production without a separate authorization and security review.

## Phase 8 real-user clothing media safety

- Canonical Development migration `026_clothing_media_lifecycle.sql` adds private original/display metadata, the private `ootie-closet-media` bucket, four owner-path Storage policies and a reference-aware delete guard.
- Supported direct inputs are JPEG, PNG and WebP up to 20 MB. Originals over 6 MB use a lazy-loaded resumable TUS path with finite retry, measured progress and cancellation. HEIC/HEIF is detected and receives an explicit conversion message; no large or unreliable browser converter is bundled.
- Browser preprocessing corrects decoded orientation, caps the display edge at 2048 px and emits WebP quality 0.88 (JPEG fallback) without cropping, recoloring or replacing the original.
- Quality feedback uses warning-only brightness, overexposure, blur, resolution and conservative edge heuristics. Malformed, unsupported, oversized, undecodable or sub-128 px files are blocking.
- Remote create is upload original → upload derivative → authenticated read verification → DB save; every pre-DB failure compensates only that operation's objects. Replace updates the DB before deleting the previous derivative and retains historical originals while the item exists.
- Referenced closet items cannot be deleted until OOTD/SOS references are removed. Unreferenced delete is DB-first, followed by best-effort path-scoped media cleanup.
- `npm run audit:orphan-media` is dry-run. Destructive cleanup requires `--delete`, `OOTIE_MEDIA_CLEANUP_CONFIRM=DELETE_ORPHANS` and a minimum 24-hour age threshold.
- Remote owner/anon/cross-user/replace/delete/logout smoke passed. No paid AI or media provider was called.

## Phase 4 commerce foundation and content polish

- User-facing authentication is email/password plus Google only. The Google action uses a recognizable four-color provider mark; Facebook OAuth is rejected by the frontend provider adapter.
- Commerce now has explicit subscription plan, credit pack, checkout order, payment status and transaction-normalization contracts. The internal Development provider remains simulation-only and uses the existing idempotent points RPCs only after a user confirms the order summary. No card fields, gateway, webhook or receipt exists.
- External product preview presents image, brand, product name and source together. A manual image prompt appears only when parsed metadata has no usable image.
- SOS cards resolve their referenced public clothing through RLS and show up to five real thumbnails with a `+N` action.
- Presentation saved content is deterministic: six OOTD targets and two SOS targets. Reset mode clears only the presentation profile's saved-outfit rows before rebuilding them.
- Notification hierarchy, event badges, unread state and mark-all-read feedback were refined without adding synthetic events. Statistics uses the approved OOTIE accent palette and improved mobile framing.
- Remote data audit after reseed: 43 presenter closet items / 43 unique images, 36 OOTD IDs / 36 images / 36 exact combinations, zero duplicate post IDs and zero duplicate combinations.
- No paid AI image request was made in Phase 4. Production remains untouched.

## Phase 9 handoff — do not launch

- Overall gate: **RED**.
- Clean local migration rehearsal: 001–027 PASS, no seed rows, 0 RLS-disabled public tables, schema lint PASS.
- Development security hardening: migration 027 applied to `OOTIE-personal-dev`; trigger-only definer functions are no longer RPC-callable.
- Production Supabase: not created. The current Free organization is at its two-active-project allowance; recurring Production cost requires explicit approval.
- Production promotion: follow `production/production-migration-manifest.json`; 020 must be replaced, 021/023 excluded, 022 reviewed, and 025 rebased.
- No Production Cloud Run service/account/secret, OAuth client, SMTP provider, domain, monitoring channel or paid AI request was created.
- Run `npm run check:production-readiness` and read `PRODUCTION_RELEASE_CHECKLIST.md` before any release activity.
