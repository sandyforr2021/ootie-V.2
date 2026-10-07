# OOTIE Production Operations Plan

Status: release planning only. No Production resource, domain, SMTP sender, monitoring vendor or paid service was activated.

## Secret inventory and ownership

The canonical value-free inventory is `production/secret-inventory.example.json`.

- Browser-safe: Production Supabase URL and publishable key, public Gateway URL, public monitoring client identifier if the selected provider documents it as publishable.
- Server-only: Supabase service role, OAuth client secret, SMTP credentials, monitoring ingestion secret when applicable, and future payment webhook secret.
- Rotation: server secrets at least every 90 days and immediately after suspected exposure; OAuth/SMTP/provider-specific rotation follows the provider procedure and uses overlapping versions where supported.
- Consumption: runtime service identity reads scoped Secret Manager entries. No JSON service-account keys.
- Forbidden locations: Git, documentation, screenshots, test fixtures, `VITE_*`, browser bundle, localStorage and client request bodies.

## Domain and DNS

No domain is selected or purchased. Candidate names such as `ootie.tw`, `www.ootie.tw` and `app.ootie.tw` must be checked with a registrar; availability must not be assumed.

After approval and purchase:

1. Choose one canonical application origin and a redirect policy for `www`/apex.
2. Map HTTPS to the Production web service through the chosen Cloud Run custom-domain/load-balancer approach.
3. Configure DNS ownership records and managed certificates.
4. Use that exact origin for canonical URLs, OG sharing, Google OAuth origin, Supabase Site URL and Gateway CORS.
5. Keep the raw Cloud Run URL out of OAuth and canonical metadata unless explicitly retained for operations.

Domain purchase is a stop condition and was not attempted.

## SMTP and auth mail

Supabase's default SMTP is not a Production mail service. A custom sender domain with SPF, DKIM and DMARC is required before public signup/reset mail.

Recommended evaluation order:

1. Resend Free for a private release rehearsal after domain verification; move to a paid tier only after volume/reliability acceptance.
2. Postmark as an alternative when transactional deliverability and support justify its recurring price.

Templates must cover confirmation (if enabled), password reset and security-sensitive events; links must return only to the canonical Production origin. Disable click tracking for authentication mail. Test failure/retry, expired links and rate limiting with test recipients only.

Paid SMTP activation and real Production mail were not performed.

## Leaked-password protection

Development reports this protection disabled. Supabase documents it as a Pro-plan feature. Production procedure:

1. Create the approved Production Pro project.
2. Enable leaked-password protection and a minimum password policy.
3. Verify new signup, normal login, reset, expired link and a known compromised-password rejection.
4. Confirm Google OAuth remains unaffected.

Do not weaken Production rules to preserve a Development presentation password.

## Monitoring and redaction

Minimum signals:

- Cloud Run request count, latency, 5xx and instance count for web/Gateway;
- Gateway provider failure rate, quota rejection, idempotency conflict and kill-switch state;
- Supabase Auth/API/Postgres/Storage errors;
- image validation/upload/DB-compensation failures;
- notification trigger/delivery and external importer failures.

The existing client monitoring abstraction remains disabled without configuration. Cloud Logging and log-based metrics are the first-party baseline. Any external provider needs a separate free/paid decision and must scrub Authorization headers, cookies, tokens, passwords, private profile fields, AI prompts, source/person/result images and payment fields.

Actionable alerts:

- web or Gateway availability failure for two consecutive checks;
- sustained 5xx above 2% with a minimum request count;
- AI provider failures above 10% over 15 minutes;
- billing at 50/80/100% and an independent daily AI cost anomaly;
- unexpected instance scaling;
- Supabase database/storage/egress threshold above 70/85/95%;
- elevated failed-login signal when the platform exposes a reliable metric.

Alerts must route to named owners and include a runbook. No Production alert channel has been configured.

## Budgets and AI cost controls

Before enabling Production inference:

- create a billing budget with 50/80/100% email/Pub/Sub alerts;
- evaluate Google Cloud budget spend caps for eligible services, understanding they are not an instantaneous hard cap;
- keep `AI_IMAGE_GENERATION_ENABLED=false` until the final approved smoke;
- start with the existing three images/member/day ceiling and an independent project-wide daily limit;
- keep model output at one image and 1K preview resolution;
- alert on unexpected Cloud Run scale, Storage growth and provider spend.

Budget alerts alone do not stop charges. The application kill switch and quotas remain primary controls. No capacity commitment or reservation is approved.

## Media retention

Proposed policy, pending legal/product review:

- clothing originals: retain while the item/account exists so user edits are reversible;
- display derivatives: retain while referenced; rebuildable derivatives may be purged only after a verified replacement;
- temporary uploads: delete after 24 hours when unreferenced, using ownership-aware dry-run audit first;
- AI person photos/results: user-controlled deletion; define a maximum retention before launch;
- public OOTD/SOS snapshots: retain while content is published, then apply documented deletion/anonymization rules;
- account deletion: quarantine/revoke access first, then execute the approved deletion/anonymization workflow.

No automatic user-original deletion is authorized.

## Backup and restore

Minimum Production plan:

- PostgreSQL: daily managed backup plus pre-release logical backup; retain at least 7 days, longer only after cost/legal review.
- Storage: versioned manifest and periodic object inventory/export to a separate protected location; database backup alone does not restore Storage objects.
- Auth references: restore through the supported project backup path while preserving `auth.users`/public-profile referential integrity.
- Migrations/configuration: Git tag plus immutable migration/secret-name inventory; never back up secret values into Git.

Quarterly restore drill:

1. Restore into an isolated non-Production target.
2. Apply/verify migrations and object inventory.
3. Check Auth-to-profile references, private/public Storage behavior and representative member journeys.
4. Record RTO/RPO, discrepancies and cleanup.

Restore status is **NOT TESTED** because the Production project does not exist. A backup claim is blocked until a restore drill passes.

## Rollback and release versioning

Version format: `v1.0.0-rc.N` for candidates and `v1.0.0` for the first approved release. A release record contains Git tag/SHA, highest migration, Supabase project ref, web revision, Gateway revision, service-worker cache version, release notes and previous stable revisions.

- Frontend/Gateway: preserve the previous Cloud Run revision; shift traffic back only after verifying its configuration and compatibility with the current DB.
- Database: prefer additive forward-fix migrations. A down migration is allowed only when data-safe and rehearsed.
- Media: never bulk-delete or roll back paths without a reference/ownership audit.
- Decision criteria: auth/security boundary regression, elevated 5xx, inaccessible private media, corrupt writes or uncontrolled AI spend cause an immediate traffic rollback/kill switch.

Redeploying an old Git commit alone is not a database rollback.

## Legal and privacy release gate

Current privacy/terms content is a draft and must not be represented as lawyer-reviewed. Before launch, review:

- privacy policy and terms;
- AI-generated content/fit/material disclaimer;
- user-photo processing and private/public publication boundary;
- data retention, deletion and export request handling;
- third-party source attribution;
- payment, refund, recurring billing and invoice/tax terms only if payment is later enabled.

Legal review is a launch blocker.

## Account deletion and data export

No complete self-service account-deletion workflow exists. Production design must inventory dependencies across profile/private profile, clothing/media, AI media/ledger, OOTD, SOS/suggestions, saved/bookmarks, likes/follows/notifications, points and future financial records.

Recommended deletion flow:

1. reauthenticate and create an idempotent deletion request;
2. freeze new writes and revoke sessions;
3. preserve financial/audit records only where legally required, otherwise anonymize them;
4. delete/private-withdraw public content according to product/legal policy;
5. delete unreferenced private media with a manifest;
6. remove Auth identity last and retain a non-identifying completion audit.

Data export should include machine-readable account/profile settings, closet metadata, posts/SOS, saved/bookmarks, social edges, points transactions and AI ledger metadata plus a bounded archive of user-owned media. Implementation is deferred, but deletion policy and request handling are launch blockers.

## SEO and crawler metadata

The Development SPA changes metadata client-side and uses `noindex`. That is correct for Development but insufficient for crawlers that do not execute JavaScript.

Production plan: retain the SPA application and add server-generated public share routes for published OOTD/SOS. The server fetches only public rows and returns title, description, canonical URL and image OG/Twitter tags; private identifiers/media never enter share HTML. All other authenticated routes stay `noindex` and client-rendered. A private prototype must validate Facebook/LINE/X link debuggers before launch.

## PWA Production review

Current service worker uses an offline shell and avoids Auth headers, Supabase/API hosts, private routes and cross-origin responses. Before Production:

- replace the fixed `ootie-shell-v1` with release-versioned cache naming;
- delete obsolete caches on activation and display an update/reload path;
- retain network-only behavior for auth, API, AI, member media and payment state;
- verify logout and service-worker upgrade cannot surface private data;
- test offline shell, stale revision recovery and install/update on iOS/Android/Desktop.

The fixed cache version is a release blocker, not a Development regression.

## Performance/CWV release gate

A single Lighthouse mobile lab run against Development on 2026-10-02 measured Performance 0.38, FCP 5.2 s, LCP 7.6 s, TBT 970 ms and CLS 0.001. It is a diagnostic baseline, not a Production field result and provides no INP.

Before launch, run three cold-load Lighthouse samples and Chrome DevTools on a real mid-range Android device/network. Record median LCP, INP interaction trace, CLS, initial JS, route chunks and largest images. Investigate the opening animation, initial JavaScript and hero media without removing the approved reduced-motion behavior. Proposed gate: LCP <= 2.5 s, INP <= 200 ms and CLS <= 0.1 at the 75th percentile once field data exists.

