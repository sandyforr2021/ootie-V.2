# OOTIE Production Release Checklist

Status snapshot: **2026-10-02 — RED / DO NOT LAUNCH**  
Allowed statuses: `PASS`, `FAIL`, `BLOCKED`, `NOT REQUIRED`.  
This checklist is evidence, not deployment authorization. Its machine-readable peer is `production/production-release-checklist.json`.

## Infrastructure

- `PASS` Development resources are isolated and remain unchanged.
- `PASS` Separate Production Cloud Run names, scaling and identity boundaries are documented.
- `BLOCKED` Dedicated Production Supabase project is not created; current Free organization is at its two-project active limit and recurring cost needs approval.
- `BLOCKED` Production web/Gateway services and identities are not created.
- `PASS` No Production launch, public traffic, real users or paid AI request occurred.

## Database

- `PASS` Development chain 001–027 rebuilds an empty local Supabase database.
- `PASS` Clean rehearsal has 15 public tables, zero rows, zero RLS-disabled public tables, 62 policies and 5 buckets.
- `PASS` Migration 027 removes direct execution of trigger-only SECURITY DEFINER functions.
- `BLOCKED` Production promotion chain must replace 020, exclude 021/023, review 022 and rebase 025.
- `BLOCKED` Remote Production migration rehearsal/Advisor run cannot occur before an approved isolated Production/rehearsal project exists.

## Auth

- `PASS` Development email/password and Google OAuth flows remain the reference implementation.
- `BLOCKED` Production OAuth client/brand, callback and origins require the final domain and Production Supabase callback.
- `BLOCKED` Production SMTP, password-reset delivery and leaked-password protection are not configured.
- `PASS` Facebook OAuth is not part of the plan.

## Storage

- `PASS` Development private/public ownership model and media lifecycle have verified tests/smoke evidence.
- `PASS` Production privacy classes and listing/write/replace/delete rules are documented.
- `BLOCKED` Production bucket/policy Advisor and cross-user smoke await the Production rehearsal project.
- `BLOCKED` Production retention durations require product/legal approval.

## AI

- `PASS` Production model/provider configuration remains server-side and adapter-based.
- `PASS` Kill switch, per-user quota, points, ownership, private Storage, ledger and idempotency gates are defined.
- `BLOCKED` Dedicated Production Gateway identity/secrets/budget are not created.
- `NOT REQUIRED` Paid Production VTO/Nano Banana smoke is intentionally deferred until final release approval.

## Email

- `PASS` Custom SMTP requirements and provider options are documented.
- `BLOCKED` Sender domain, SPF, DKIM, DMARC, templates and provider credentials require the chosen/purchased domain and cost approval where applicable.
- `NOT REQUIRED` No real Production email is sent in this gate.

## Domain

- `BLOCKED` Production domain is not selected, purchased or verified.
- `BLOCKED` DNS, HTTPS, canonical origin and www/apex redirect are not configured.
- `PASS` Domain purchase remains an explicit stop condition.

## Security

- `PASS` No Production secret is present in the templates, docs or frontend source added by this phase.
- `PASS` Development ACL hardening 027 is applied and Advisor-confirmed.
- `BLOCKED` Four Development demo/points SECURITY DEFINER RPC warnings require removal/replacement in the Production chain.
- `BLOCKED` Leaked-password protection requires the approved Production Pro plan and regression test.
- `BLOCKED` Production Advisor, OAuth redirect, CORS, importer SSRF and secret-scan evidence must be captured against the final candidate.

## Legal

- `FAIL` Privacy/Terms remain drafts and are not lawyer-reviewed.
- `BLOCKED` Data retention, account deletion, export handling and AI/photo disclosures require approved policy and implementation decisions.
- `NOT REQUIRED` Payment terms/refund/recurring/invoice copy is not needed while real payment remains disabled.

## Monitoring

- `PASS` Signal, redaction and alert definitions are documented.
- `BLOCKED` Production log-based metrics, uptime checks, routing and alert ownership are not configured/tested.

## Backups

- `PASS` PostgreSQL/Storage/config backup and quarterly restore-drill plan is documented.
- `BLOCKED` Production backup retention cannot be configured before the project/plan exists.
- `FAIL` No Production restore drill has passed; no backup-complete claim is allowed.

## Rollback

- `PASS` Cloud Run traffic rollback, DB forward-fix and media safety criteria are documented.
- `BLOCKED` No Production previous-stable revision or migration compatibility record exists yet.
- `BLOCKED` A full candidate rollback simulation requires Production-like infrastructure.

## Performance

- `PASS` A Development Lighthouse diagnostic baseline was captured.
- `FAIL` The one-run mobile lab baseline (LCP 7.6 s, TBT 970 ms) is not release-ready evidence.
- `BLOCKED` Real-device and multi-run LCP/INP/CLS acceptance is still required.

## PWA

- `PASS` Private/auth/API responses are excluded from current service-worker caching.
- `BLOCKED` Fixed `ootie-shell-v1` cache naming needs release-versioned invalidation and stale-worker QA.

## Payments

- `PASS` Real payment is disabled and no card/webhook/receipt claim exists.
- `PASS` Free/limited beta without payment is the recommended launch option.
- `BLOCKED` Development demo subscription/purchase RPCs must not enter Production.
- `NOT REQUIRED` A payment provider is not required for a free beta.

## QA

- `PASS` Local Development schema rehearsal succeeded from zero.
- `BLOCKED` Final test/build/E2E/secret-scan results are recorded only after this Phase 9 verification run completes.
- `BLOCKED` Production-like auth/upload/social journey requires the approved Production rehearsal environment.
- `PASS` No unnecessary paid AI test is part of this gate.

## Overall gate

- `FAIL` Overall release decision: **RED**.
- `BLOCKED` Final approval cannot be requested until the exact blockers above are closed or explicitly accepted where non-critical.

