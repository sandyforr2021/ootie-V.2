# OOTIE Status Matrix — 2026-10-01

| Area | Local implementation | Automated verification | External/live status |
| --- | --- | --- | --- |
| AI Assistant UI | Complete | UI contract + member gate tests pass | Local Development configured for new Supabase/Gateway |
| Structured AI Styling adapter | Complete | Rejects invented/unowned ID | No paid styling smoke requested |
| OOTIE AI Gateway / Cloud Run service | Complete; points-aware | Gateway tests 15/15 | Deployed: `ootie-ai-gateway-dev-00006-xjh` |
| Single Virtual Try-On adapter | Complete | `sampleCount=1`, env model/region test | One live request passed |
| AI outfit preview adapter | Complete | one candidate, 1K, env model test | One live request passed |
| Supabase Auth verification | Complete | Guest/logout/CORS tests pass | Missing/invalid JWT, member and logout flows verified remotely |
| Clothing ownership protection | Complete | Cross-owner rejection test passes | Cross-owner paid generation rejected before provider |
| Private person/result images | Complete migration + Gateway code | path/MIME/size/static RLS checks pass | Owner 200, cross-member 403, logout 401 |
| AI usage ledger | Complete migration | No generated Base64 test/static check pass | Both live results recorded path-only |
| Daily quota | Complete | quota/provider-block test passes | Remote quota verified; limit 3 |
| Kill switch | Complete | provider-block test passes | Development enabled after gate; Production unchanged |
| Idempotency | Complete | duplicate ID invokes provider once | Live duplicate returned existing VTO result |
| Provider/safety errors | Complete | explicit provider/safety tests pass | Live rejection not run |
| Former provider removal | Runtime and repository references removed | final repository scan complete | No Git history rewrite |
| Browser Google secrets | None added | repository/dist scan complete | Correct Secret Manager version bound; no key file |
| Vue tests | Complete | 52 files / 215 tests passed | N/A |
| Supabase isolation/seed tests | Complete | 5/5 passed | Seed rerun passed without duplicates |
| Production build | Complete | Vite build passed | Not deployed |
| Supabase migration 001–025 | Canonical chain + manifest | all static validators PASS | Applied to `OOTIE-personal-dev` |
| Demo account/data | Complete | stable UUID/count contract | 12 profiles, 42 presenter items, 36 OOTDs, 12 SOS |
| Demo subscription/points | Complete, simulation-only | provider, grants, deduction/idempotency tests | PLUS, 245 points, yearly birthday reward |
| Guest/member homepage | Complete | difference tests pass | Recent 7-day popularity shown from remote data |
| Responsive Demo | Complete | browser smoke | 1440/1024/768/390, no page overflow or broken loaded images |
| Supabase Advisors | Complete | Performance 0 errors/0 warnings/9 info | Security: 0 errors, 5 classified warnings |
| Cloud preflight | Complete | health/Auth/CORS/Storage/quota checks pass | Billing/Credit/model/IAM verified |
| Live Smoke | Complete | Exactly one VTO + one 1K preview | Both succeeded; no retries/batch |
| Billing attribution | Project endpoint/ADC confirmed | Ledger estimate US$0.13 | Console posting delta pending |
| Production enablement | Out of scope | N/A | NOT AUTHORIZED |

Remaining remote work: create/connect the Google OAuth client after explicit credential-creation confirmation. Leaked-password protection requires a paid Supabase plan and was not enabled. Four intentional authenticated subscription/points RPC warnings remain. Production remains unauthorized.

## Phase 3 additions

| Area | Status | Evidence / remaining gate |
| --- | --- | --- |
| Remote Follow | Complete | Remote persistence, counts, self/duplicate guards and RLS smoke pass |
| Notifications | Complete | Follow/like/SOS events, dedupe, read and mark-all-read implemented |
| External product import | Complete | Authenticated server parser, SSRF boundary and save/convert E2E pass |
| Google OAuth | Complete | Independent OOTIE Development OAuth project, Preview callback and live login/logout/returnTo/profile bootstrap passed |
| Weather | Complete | geolocation states, manual city and private saved preference implemented |
| Route splitting | Complete | Initial JS 768.74 kB → 487.15 kB; Statistics isolated to 222.90 kB |
| Accessibility | Presentation baseline complete | focus-visible, modal focus, labels/live status/reduced motion |
| Phase 3 E2E | Complete | Guest/member/social/import journeys remain covered |

## Phase 4 additions

| Area | Status | Evidence / boundary |
| --- | --- | --- |
| Auth provider presentation | Complete | Email/password + Google only; Google mark visible; Facebook OAuth rejected |
| Commerce foundation | Complete | Plan/pack/order/status/transaction contracts and confirmable order summary; no real gateway or payment data |
| Product URL preview | Complete | Parsed image, brand, name and attribution shown together; manual image fallback retained |
| SOS clothing context | Complete | RLS-readable referenced items resolve remotely; 3–5 thumbnails and `+N` supported |
| Saved outfits | Complete | 8 deterministic remote entries: 6 OOTD + 2 SOS |
| Notifications | Complete | Event hierarchy, badges, unread distinction and read feedback use remote rows |
| Statistics | Complete | Existing real metrics only; palette, framing and mobile table readability polished |
| Asset QA | Complete | 43/43 closet images unique and reachable; 36/36 OOTD images unique; no mobile overflow/broken visible images |
| Production | Unchanged | No Production deployment, secrets, payment or AI request |
# Phase 8 media safety — Development

| Area | Status | Evidence |
| --- | --- | --- |
| Clothing input validation | PASS | JPEG/PNG/WebP byte signatures, decoded image, 20 MB and 128 px blocking limits; >6 MB originals use lazy TUS resume/progress/cancel |
| Quality guidance | PASS | Dark, overexposed, blur, low-resolution and edge-risk warning heuristics; one-item user confirmation |
| Original preservation | PASS | Private original plus separate display derivative; replacement keeps old original |
| DB/Storage consistency | PASS | Operation-scoped compensation on upload/verification/DB failure |
| Storage privacy | PASS | Private bucket, four owner-path policies; anon and cross-user remote smoke denied |
| Replace/delete | PASS | New-first replace, DB-first delete, canonical OOTD/SOS reference guard |
| Orphan maintenance | PASS | Dry-run default, age threshold, protected historical originals, explicit destructive flag |
| HEIC/HEIF | GRACEFUL FALLBACK | Detected with truthful JPEG/PNG/WebP conversion guidance; no bundled converter |
| Background cleanup | CONTRACT ONLY | Clearly unavailable; no fake result and no paid provider |
| Production | UNCHANGED | Development Supabase and Development Preview only |

## Phase 9 Production readiness — 2026-10-02

| Area | Status | Evidence / blocker |
| --- | --- | --- |
| Production architecture | PASS (plan) | Separate web/Gateway/Supabase/Auth/domain/SMTP boundaries documented |
| Production Supabase | BLOCKED | Free org already has two active projects; no recurring-cost approval, no project created |
| Migration rehearsal | PASS for Development chain | 001–027 from zero, zero seed rows, 0 RLS-disabled tables, local lint PASS |
| Production migration chain | BLOCKED | 020 replace; 021/023 exclude; 022 review; 025 rebase |
| Development ACL hardening | PASS | Migration 027 remote ACL checks PASS; Advisors rerun |
| Production OAuth/domain/SMTP | BLOCKED | Requires chosen domain and Production Supabase callback/project |
| Backups/restore | BLOCKED | Plan exists; no Production restore drill |
| Monitoring/budget | BLOCKED | Plan exists; Production resources/alerts/budget not configured |
| Legal/deletion/export | FAIL/BLOCKED | Draft legal copy; deletion/export policy/workflow incomplete |
| Performance | FAIL | One-run Dev lab: LCP 7.6 s, TBT 970 ms; real-device/INP gate outstanding |
| PWA/SEO | BLOCKED | Fixed cache version and client-only social metadata need Production work |
| Real payment | NOT REQUIRED | Disabled; free/limited beta recommended |
| Public Production launch | NOT AUTHORIZED | No Production service/domain/user traffic created |

