# OOTIE AI Provider Architecture

狀態：本機實作、Cloud Run Development 部署、Supabase 001–019、mock tests 與各一次受限 VTO／1K outfit-preview Live Smoke 已完成；Production 未部署。

## Runtime boundary

```text
Vue OOTIE
  │  Supabase user JWT + generation ID + item IDs/person photo path
  ▼
OOTIE AI Gateway on Cloud Run
  ├─ verify Supabase JWT with /auth/v1/user
  ├─ resolve auth.users.id → ootie_profiles.id
  ├─ re-query owned ootie_clothing_items
  ├─ atomic quota/idempotency claim
  ├─ fetch private person/clothing images
  └─ AIProvider
       ├─ GoogleStylingProvider → Gemini Flash text
       ├─ GoogleVtoProvider → Virtual Try-On
       └─ GoogleNanoBananaProvider → Gemini image composition
               │
               ▼
       private Supabase Storage + ootie_ai_generations ledger
```

Vue components do not contain model IDs. They call the browser-safe adapter in `src/services/aiGateway.js`; actual model selection is read only by `gateway/src/config.js` from server environment.

## Provider contract

`gateway/src/providers/googleAiProvider.js` exposes:

- `recommendOutfit()`
- `generateSingleGarmentTryOn()`
- `generateOutfitPreview()`
- `healthCheck()`

VTO and multi-image outfit preview are separate adapters and have no silent runtime fallback. If VTO is unavailable, the UI may offer 「改用 AI 穿搭預覽」 only as an explicit user choice.

## API routes

| Method | Route | Purpose | Paid AI |
| --- | --- | --- | --- |
| GET | `/health` | Liveness/config presence; returns no secret/model ID | No |
| GET | `/v1/capabilities` | Kill-switch and quota UI state | No |
| POST | `/v1/person-photos` | Validate and upload a private person image | No |
| GET | `/v1/person-photos` | List owned private person-photo paths | No |
| DELETE | `/v1/person-photos/:photoId` | Resolve and delete only the authenticated owner's private photo | No |
| GET | `/v1/private-images/:encodedPath` | JWT-protected private image bytes; no signed bearer URL | No |
| POST | `/v1/recommendations` | Structured wardrobe styling | Yes |
| POST | `/v1/generations/single-try-on` | One-person, one-garment VTO | Yes |
| POST | `/v1/generations/outfit-preview` | Person + 1–5 garment references | Yes |
| GET | `/v1/generations` | Refresh private result history | No |
| POST | `/v1/generations/:id/save` | Mark completed result saved | No |

All `/v1/*` routes require a valid Supabase member JWT. The Gateway ignores any client-supplied `userId`, `profileId`, or `ownerId`; those fields are not part of the public request contract.

## Styling integrity

The Gateway reads at most 200 visible items belonging to the verified profile and sends an allow-list of IDs and metadata to the text model. Vertex structured output is required to match:

```json
{
  "outfitTitle": "string",
  "reason": "string",
  "style": "string",
  "occasion": "string",
  "weatherNote": "string",
  "items": [
    {
      "clothingItemId": "uuid from allowed wardrobe",
      "role": "string",
      "reason": "string"
    }
  ]
}
```

After the model responds, every ID is checked again against the owned-item map. An invented, duplicate, missing, or unowned ID causes `INVALID_PROVIDER_OUTPUT`; it is never shown as a valid recommendation.

## Image security

- Client person-photo uploads accept JPEG/PNG only and centrally normalize EXIF orientation, maximum edge and JPEG quality.
- Gateway checks Base64 data URL shape, magic bytes, claimed MIME, 7 MB limit, and 256–4096 px edge bounds.
- Owned clothing inputs may be JPEG, PNG or WebP. WebP display media is decoded server-side and converted in memory to a validated JPEG AI derivative; the original Storage object remains unchanged.
- Generate requests contain an owned private person-photo path and clothing item IDs, not an arbitrary remote URL.
- A clothing image can come only from owned database image data or the configured Supabase origin. The Gateway rejects other origins and does not follow redirects, preventing request-body SSRF.
- Person and result paths are `person/{auth_user_id}/...` and `ai-generated/{auth_user_id}/{generation_id}/result.*` in the private `ootie-ai-private` bucket.
- The database stores a path, model/provider metadata and status; it never stores generated image Base64.
- Logging is intentionally limited to server lifecycle messages; credentials and image bodies are not logged.

## Authentication and authorization

1. Gateway sends the bearer token to the configured Supabase Auth `/auth/v1/user` endpoint.
2. A valid permanent user UUID is required; anonymous users are rejected.
3. Gateway uses its server-only service role to resolve exactly one `ootie_profiles` row.
4. Selected `ootie_clothing_items` must match that profile ID.
5. Person image path must begin with the verified Auth user ID.
6. Private Storage RLS grants authenticated browser reads only when path segment 2 equals `auth.uid()`.

Service-role operations bypass RLS, so all service-role paths and row filters are created from the verified user, never from body owner fields.

## Idempotency and quota

`claim_ootie_ai_generation()` uses a user/day advisory transaction lock. It checks the generation UUID, counts image claims in the configured timezone, and inserts the pending ledger row atomically. A duplicate successful request returns the existing private result path; the browser reloads bytes through the JWT-protected Gateway. Pending/failed duplicate IDs do not call the provider again. A user-requested regeneration always creates a new UUID.

## Current providers and lifecycle

| Capability | Environment | Current intended value | Lifecycle note |
| --- | --- | --- | --- |
| Styling | `GOOGLE_STYLING_MODEL` | `gemini-3.5-flash` | GA Flash-class text model; published lifecycle is May 19, 2027 or later |
| Single VTO | `GOOGLE_VTO_MODEL` | `virtual-try-on-001` | GA; official model card has a retirement date, so quarterly review is required |
| Outfit preview | `GOOGLE_IMAGE_MODEL` | `gemini-3.1-flash-image` | Project model API reported GA on 2026-10-01; official lifecycle must still be rechecked before Production |

Official references:

- Virtual Try-On model: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/vto/virtual-try-on-001
- Virtual Try-On request: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/generate-virtual-try-on-images
- Gemini image generation: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/image-generation
- Vertex release notes: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes

## Provider/model replacement procedure

1. Review official lifecycle, region, launch stage, request/response schema, safety behavior and pricing.
2. Add or update one adapter under `gateway/src/providers/`; do not edit Vue components.
3. Keep the same provider contract and normalized error codes.
4. Add contract tests for sample count/candidate count, output extraction, safety rejection and invented item IDs.
5. Set the new model only in server environment and update setup/cost documents.
6. Keep `AI_IMAGE_GENERATION_ENABLED=false` while deploying.
7. Run mock tests, then the Preflight Gate, then one paid smoke request after explicit approval.
8. Confirm Billing attribution before enabling broader development use.
