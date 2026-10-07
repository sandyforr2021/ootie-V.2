# OOTIE Production Architecture (Release Gate Draft)

Status: **RED / planning and rehearsal only**  
Date: 2026-10-02  
Authority: this document does not authorize a public launch, a paid subscription, real payment, or real-user migration.

## Environment boundaries

| Boundary | Development | Release-candidate rehearsal | Future Production |
| --- | --- | --- | --- |
| Frontend | `ootie-web-dev` | local/private candidate only | `ootie-web` |
| AI Gateway | `ootie-ai-gateway-dev` | local/private candidate only | `ootie-ai-gateway` |
| Supabase | `OOTIE-personal-dev` / `hoxkrmadzjnyjaqjbyxc` | local clean database until a paid Production project is approved | dedicated OOTIE Production project |
| Google OAuth | independent OOTIE Development brand/client | no public client | separate OOTIE Production brand/client |
| Public domain | Cloud Run Development Preview | none | chosen custom domain, not selected or purchased |
| Data | deterministic presentation data | schema only, no real users | Production-safe reference content only |
| Payments | internal simulation only | disabled | disabled until a separate payment go-live batch |

Development values are never valid Production defaults. Production deployment must fail closed if a required value is absent, contains `-dev`, points at `hoxkrmadzjnyjaqjbyxc`, uses localhost, or references the Development Cloud Run URL.

## Target topology

```text
Browser on the approved Production origin
  -> OOTIE Production Web (`ootie-web`, public HTTPS)
  -> Production Supabase (Auth, Postgres, Storage)
  -> OOTIE Production AI Gateway (`ootie-ai-gateway`, public HTTPS ingress)
       application layer verifies Production Supabase JWT
       ownership, points, quota, idempotency and kill switch run first
       -> Vertex AI in `ferrous-phoenix-16888` through a dedicated Production runtime identity
```

Using the current billed Google Cloud project for inference is acceptable only if the Production Cloud Run services, service accounts, secrets, budgets, logs and labels are separate. The unrelated n8n identities, OAuth brand and secrets remain out of scope and untouched.

## Cloud Run Production plan

Region: `asia-southeast1`, matching the current AI endpoint preference and Development deployment.

| Service | Proposed conservative start | Identity and access |
| --- | --- | --- |
| `ootie-web` | min 0, max 3, concurrency 80, 1 vCPU, 512 MiB, 60 s timeout | dedicated web runtime identity; no Vertex role, no Supabase service role and no unrelated Secret Manager access |
| `ootie-ai-gateway` | min 0, max 2, concurrency 4, 1 vCPU, 1 GiB, 600 s timeout | dedicated gateway runtime identity; `roles/aiplatform.user`; Secret Manager access scoped only to Production Gateway secrets |

Both services may accept unauthenticated Cloud Run invocation because the web content is public and the Gateway validates a Supabase bearer token in the application layer. Gateway CORS is restricted to the final Production origin. No `*`, localhost, Development Preview or arbitrary `run.app` origin is allowed in Production.

No minimum always-on capacity, Provisioned Throughput or reservation is approved. No service or service account has been created by this gate.

## Supabase Production status and cost gate

The active organization is on the Free plan and already contains two active projects. A third active project does not fit the Free project allowance. A production-grade separate Supabase organization/project therefore requires an explicit recurring-cost decision before creation. The preferred isolation is a new Production-only Pro organization with one Micro project rather than placing Production beside both Development projects.

No Production Supabase project was created. The approved region remains `ap-southeast-1` unless legal/data-residency review selects another region before creation.

## Production migration policy

The Development chain 001–027 builds successfully from zero, but it is not a Production promotion set as-is:

- 001–019: schema foundation, subject to removing stale Development target comments and final policy review.
- 020: replace with a Production-safe entitlements/points migration; never create `ootie_demo_subscriptions` or demo purchase RPCs in Production.
- 021 and 023: exclude; they are Development seed/service-role grants.
- 022: schema content is useful, but its Development-only annotation and grants require review.
- 024, 026 and 027: security/media hardening candidates for Production.
- 025: rebase onto the replacement for 020 because it indexes the AI point-transaction reference.

The exact disposition is machine-readable in `production/production-migration-manifest.json`. A Production project cannot be created until every `REPLACE`/`REVIEW` entry has a reviewed replacement and the final chain passes a second clean rehearsal.

## Production data classes

| Class | Content | Launch action |
| --- | --- | --- |
| A — required | schema, auth bootstrap, plan/reference constants, policy metadata | migrate from reviewed Production chain |
| B — optional | editorial starter content with owned/licensed assets and no fake engagement | separate reviewed Production content seed |
| C — Development-only | local/preview configuration, smoke users, test notifications, seed-runner grants | exclude |
| D — Demo-only | presenter account, fake social profiles/OOTDs/SOS, saved outfits, demo subscription/payment state, AI smoke ledgers | exclude |

The presentation seed script must never run against Production. Production starts empty unless a separate content provenance review approves class B.

## Auth and OAuth Production plan

1. Select and verify the final custom domain.
2. Create a separate OOTIE Production Google OAuth client/brand; do not reuse the Development client and do not modify the n8n brand.
3. Register only the final Production web origins and the new Production Supabase callback.
4. Configure Production Supabase Site URL and redirect allowlist without localhost or Development Preview.
5. Test email/password, Google login, profile bootstrap without duplicate profiles, logout, `returnTo`, password reset and protected routes with disposable Production test accounts.

No Production OAuth client or callback was created because the domain and Production Supabase project do not yet exist.

## Storage and privacy classes

Private by default:

- clothing originals and display derivatives;
- person photos;
- AI generated results;
- private profile/account media and saved member-only content.

Public only after an explicit product action:

- published OOTD snapshot;
- approved public avatar;
- public SOS imagery where the current content policy allows it.

Public object delivery does not imply public bucket listing. Owner-only write/replace/delete, cross-user denial, signed/private access and reference-aware media cleanup remain mandatory. A processed derivative never broadens the original's visibility.

## Production CORS

The future Gateway allowlist is exactly the canonical Production origin plus a separately approved staging origin, if staging exists. It must not contain `*`, localhost, the Development Preview, or transient Cloud Run URLs. Development CORS remains unchanged.

## AI Production policy

- Paid generation is authenticated and server-side only.
- Ownership, points, per-user daily quota, application idempotency and `AI_IMAGE_GENERATION_ENABLED` run before provider invocation.
- `sampleCount=1`; image preview remains one 1K output unless a later cost decision changes it.
- Person/source/result media remain private; the ledger stores paths, never generated Base64.
- Model IDs and locations remain server environment variables.
- Model lifecycle changes require an adapter/config migration and explicit user-facing fallback; no silent third-party provider substitution.
- Production AI starts disabled until the final low-cost, explicitly approved Production smoke.

## Payment go/no-go

Recommendation: launch a bounded free/limited beta without real payment. Grant promotional credits through a reviewed administrative path and retain the hard project/member quotas. Hide or disable Development subscription/credit simulation in Production.

A future Taiwan payment batch must select a provider, implement signed webhooks, idempotent order settlement, recurring billing decisions, refunds, invoice/tax handling, reconciliation and legal copy. ECPay and NewebPay are candidates, not integrations or commitments.

