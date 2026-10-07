# Google Cloud AI Setup and Live Smoke Gate

This document contains no credential value. Do not put service account JSON, access tokens, Supabase service-role keys or secrets in Git, browser code, `VITE_*`, request bodies or localStorage.

## Selected runtime design

- Cloud Run hosts OOTIE AI Gateway.
- The Cloud Run service uses an attached service account and Application Default Credentials via the metadata server.
- Google Cloud AI inference stays in the Google Cloud Project that owns the applicable Cloud Credit/Billing.
- Supabase remains responsible for Auth, database, closet/profile data, private Storage and result metadata.
- Google AI Studio / Gemini Developer API is not a production provider.

## Server environment

Copy names from `gateway/env.example`; provide real values only through Cloud Run configuration/Secret Manager.

```env
GOOGLE_CLOUD_PROJECT=ferrous-phoenix-16888
GOOGLE_CLOUD_LOCATION_STYLING=global
GOOGLE_CLOUD_LOCATION_VTO=asia-southeast1
GOOGLE_CLOUD_LOCATION_IMAGE=global
GOOGLE_STYLING_MODEL=gemini-3.5-flash
GOOGLE_VTO_MODEL=virtual-try-on-001
GOOGLE_IMAGE_MODEL=gemini-3.1-flash-image
AI_IMAGE_GENERATION_ENABLED=true
AI_MAX_IMAGES_PER_USER_PER_DAY=3
AI_QUOTA_TIMEZONE=Asia/Taipei
AI_IMAGE_OUTPUT_SIZE=1K
SUPABASE_URL=https://hoxkrmadzjnyjaqjbyxc.supabase.co
SUPABASE_PUBLISHABLE_KEY=publishable-key
SUPABASE_SERVICE_ROLE_KEY=secret-reference-only
SUPABASE_AI_BUCKET=ootie-ai-private
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
```

`SUPABASE_SERVICE_ROLE_KEY` must be bound as a Cloud Run secret, not typed into a frontend environment. Non-secret model/project/location values belong in ordinary server environment.

## Google Cloud preparation

1. Select the exact project that owns the intended remaining Cloud Credit.
2. Confirm the linked Billing account and current credit/expiry in Cloud Billing.
3. Configure a project budget and alerts.
4. Enable Cloud Run and Vertex/Agent Platform APIs required by the current console/API surface. Deployment may also require Artifact Registry and Cloud Build.
5. Create a dedicated runtime service account; do not create/download a private key.
6. Grant only the runtime permission needed to invoke Vertex AI (normally `roles/aiplatform.user`). Add Secret Manager access only for the specific Supabase secret if Secret Manager is used.
7. Deploy Cloud Run in an approved region. The browser must be able to reach it; application routes still require Supabase JWT verification.
8. Apply and verify `supabase/personal_baseline/001_*.sql` through `019_*.sql` under the separate Supabase migration gate before using the Gateway.
9. Keep `AI_IMAGE_GENERATION_ENABLED=false`; verify `/health`, Auth, CORS, Storage and quota behavior with non-paid tests.

## Preflight checklist — current status

| Check | Required evidence | Current status |
| --- | --- | --- |
| Google Cloud Project ID | Exact project ID selected in Cloud Console and Gateway env | PASS — `ferrous-phoenix-16888` / number `514646530789` |
| Billing account | Active account linked to that project | PASS — linked/open `019A87-218B6A-CD27F6` |
| Remaining Credit | Amount and expiry visible in Billing | PASS — Free Trial TWD 9,448.92 remaining (97%), expiry 2026-11-18 when checked |
| Vertex / Agent Platform API | Enabled in the same project | PASS — `aiplatform.googleapis.com` enabled |
| Required APIs | Run, Cloud Build, Artifact Registry, Secret Manager | PASS |
| Required IAM | Dedicated Cloud Run runtime service account has least-privilege Vertex access | PASS — `roles/aiplatform.user` |
| Service Account | Attached to Cloud Run; no key file | PASS — `ootie-ai-gateway@ferrous-phoenix-16888.iam.gserviceaccount.com` |
| Styling Region/Model | GA Flash-class model in `global` | PASS (docs) — `gemini-3.5-flash`, lifecycle May 19, 2027 or later |
| VTO Region | `asia-southeast1` | PASS — live request succeeded |
| VTO Model | `virtual-try-on-001` | PASS — project API GA; one `sampleCount=1` smoke succeeded |
| Image Model | `gemini-3.1-flash-image` | PASS — project API reported GA; one 1K smoke succeeded |
| Kill switch | `false` before smoke, bounded enable afterward | PASS — blocking verified; Development now enabled |
| Per-user quota | Positive `AI_MAX_IMAGES_PER_USER_PER_DAY`, initial recommendation 3 | PASS — DB claim + deployed value 3 |
| Supabase migration | Table/function/private bucket/RLS applied and verified | PASS — 001–019 on `OOTIE-personal-dev` |
| CORS/Auth | Exact frontend origin and invalid JWT rejection | PASS — remote 204/401/403 checks |
| Server secret | Correct service-role value via Secret Manager | PASS — corrected version bound; prior bad version disabled |

All paid-gate rows passed before the two bounded Development requests were sent.

## Live Smoke execution record

1. VTO: generation `8c98834d-2ef5-4e55-aeba-cceb7c0c0ade`, one person, one owned garment, `sampleCount=1`, succeeded.
2. Outfit preview: generation `2e331a97-adc8-42a4-8ad0-1be947ab1c5a`, one 1K output, succeeded.
3. Both private result paths and ledger rows were verified; owner/cross-member/logout behavior passed.
4. Duplicate VTO generation ID returned the stored result without another provider request.
5. Exactly two provider requests were made under project `ferrous-phoenix-16888`; immediate Billing credit balance did not yet show a posted delta.
6. Production remains disabled/unmodified.

## Model lifecycle gate

`virtual-try-on-001` and `gemini-3.1-flash-image` both reported GA through the selected project's Vertex model API on 2026-10-01. `gemini-3.5-flash` is the configured styling model. Check official lifecycle at every deployment and at least quarterly because launch stages and retirement dates change. Replacement occurs in server env/adapter tests, never in Vue model IDs.
