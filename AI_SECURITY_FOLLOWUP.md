# OOTIE AI Security Follow-up

## Current status

The former browser-side paid-provider integration and its unsafe client credential path have been removed from the repository. The current implementation uses the authenticated OOTIE AI Gateway described in `AI_PROVIDER_ARCHITECTURE.md`.

## Enforced boundary

- Vue sends only authenticated product requests to the Gateway.
- Google model IDs, Cloud Project configuration and credentials remain server-side.
- Cloud Run uses an attached service account and Application Default Credentials.
- The Gateway verifies Supabase identity and re-checks clothing ownership.
- Person photos and generated results remain in private Storage.
- Quota, kill switch and generation-ID idempotency run before image inference.
- Provider errors never silently switch generation mode.

## Remaining gate

Local implementation does not authorize deployment or paid inference. Complete the checklist in `GOOGLE_CLOUD_AI_SETUP.md`, apply the reviewed Supabase migration separately, and obtain explicit user confirmation before the first one-image Live Smoke.
