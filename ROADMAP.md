# OOTIE Roadmap

## Current Batch — local and Development infrastructure complete

- AI Styling with schema-valid output and wardrobe ownership validation.
- Google Cloud-only provider architecture; former third-party provider runtime removed.
- Cloud Run Gateway with Supabase JWT verification and server-only Google ADC.
- Single-item Virtual Try-On and separate outfit visualization adapters.
- Private person/result Storage, AI ledger, kill switch, quota and idempotency.
- OOTIE Design System UI for empty/loading/error/generating/result/quota/provider/safety states.
- Mock, unit, integration, isolation, migration static validation and production build.

## Gate 1 — Supabase review and apply (complete)

1. Dedicated Free `OOTIE-personal-dev` created; contaminated project untouched.
2. Canonical 001–019 applied in order.
3. 13/13 OOTIE public tables have RLS enabled; four buckets and AI claim RPC verified.
4. Public listing policies removed; owner-only replace/delete restored; full three-bucket Storage smoke passed.

## Gate 2 — Google Cloud preflight (complete)

1. Unique billed project `ferrous-phoenix-16888` and Billing account link confirmed.
2. Required APIs, dedicated runtime service account and least-privilege bindings confirmed.
3. Development Gateway deployed in Singapore with quota 3, exact local origins and keyless runtime identity.
4. Health, missing/invalid JWT, CORS, member ownership, private Storage, kill switch, quota and idempotency verified.
5. Remaining promotional credit and model availability were confirmed before inference.

## Gate 3 — bounded paid Live Smoke (complete)

Exactly one synthetic person image + one owned garment VTO (`sampleCount=1`) and one 1K Nano Banana request succeeded. Private result, ledger, idempotency, cross-member denial and logout denial passed. The calls were made under the selected billed project; the console cost/credit delta is still pending normal posting latency. No batch generation occurred.

## Demo Completion Sprint — complete

- Re-runnable Development seed creates one stable presenter account, 12 profiles, 64 garments, 36 OOTD posts, 12 SOS posts and varied engagement/history.
- Guest and member Home experiences now use real public/member data and valid routes.
- Development-only FREE / PLUS / PRO subscription simulation, credit packs, points history and annual birthday reward are implemented without payment collection.
- AI image actions check configurable point cost in addition to the existing server kill switch, daily quota and generation idempotency.
- Desktop, laptop, tablet and mobile presentation routes were checked at 1440, 1024, 768 and 390 px.
- Production remains untouched. Demo subscription actions are never represented as real payments.

## Future — OOTIE Visual Design Phase (intentionally postponed)

- Retain the mature editorial / lifestyle fashion direction that is working today.
- Add more modern, cool visual energy because the current palette can feel muted or dull; explore restrained silver, blue and violet accents.
- Consider richer motion, hover behavior, texture and logo animation only in the dedicated future phase.
- Keep every UI area tied to real OOTIE functionality; do not add empty decorative interaction zones.
- Do not let the visual phase weaken accessibility, responsive behavior, private-content boundaries or cost controls.

## Future BATCH-10 — External Brand Product Import

- Preserve the bounded flow: product URL → metadata parser → JSON-LD / OpenGraph preview → explicit save with source URL.
- Do not add bulk scraping or claim unofficial data as official SKU information.
- Keep import validation, provenance and ownership checks server-side where required.

## After a successful smoke — separate decision

- Decide whether to open a bounded development cohort; do not auto-promote to Production.
- Add scheduled lifecycle monitoring for VTO retirement and Gemini image launch-stage changes.
- Calibrate estimated cost fields from actual Billing evidence.
- Define automated person-photo retention only after the product policy is approved; owner-verified manual deletion is complete.
- Add explicit OOTD publishing flow that copies an approved private result into public content only after user action.
- Route-level code splitting is complete; split the Statistics chart vendor chunk only if later measurements justify it.

## Phase 3 follow-up

- Complete the one-time Google OAuth client/provider setup after credential-creation confirmation, then smoke callback, profile bootstrap, logout and returnTo.
- Facebook OAuth remains postponed until Google OAuth is stable.
- Consider controlled egress/allowlisting before expanding external import beyond single submitted product pages.
- Upgrade Vite/Vitest majors in a dedicated compatibility batch; current audit advisories affect development tooling, not the built runtime.

No roadmap item authorizes deployment, quota increases, paid retries or Production traffic by itself.

## Phase 9 — Production Readiness Gate (RED)

- Complete the Production-safe promotion chain that removes Development demo/seed grants.
- Obtain explicit recurring-cost approval, then create an isolated Production Supabase project.
- Select/purchase the domain, configure Production OAuth/SMTP/CORS, and keep n8n/Development identities untouched.
- Implement account deletion/export policy, obtain legal review, and complete a backup restore drill.
- Add versioned PWA cache invalidation and server-generated public share metadata.
- Fix Development Lighthouse performance findings and pass real-device LCP/INP/CLS acceptance.
- Configure monitoring, alert routing, budget/spend controls and dedicated Production service identities.
- Run a second clean migration rehearsal plus private Production candidate QA, then request final Release approval.
