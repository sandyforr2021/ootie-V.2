# OOTIE AI Cost Control

## Enforced controls

- `AI_IMAGE_GENERATION_ENABLED=false` is the safe deployment default and blocks before quota claim/provider access.
- `AI_MAX_IMAGES_PER_USER_PER_DAY` is enforced server-side by an atomic PostgreSQL claim function.
- VTO always sends `sampleCount: 1`.
- Outfit preview always sends `candidateCount: 1` and development `imageSize: 1K`.
- Only 「生成試穿」 or 「生成穿搭預覽」 can start image inference.
- No generation on page load, hover, recommendation completion, background task or route transition.
- Browser and Gateway have no automatic AI retry. Network timeout returns an error explaining that the request was not resent.
- Request buttons are disabled while running.
- Every request has a client-generated UUID and a database idempotency claim.
- VTO failure never silently changes model/provider.
- Successful bytes go to private Storage; Base64 is not retained in PostgreSQL.

Current Development deployment is enabled only after the bounded smokes passed. It remains limited to 3 image claims per member per Asia/Taipei day, one output per request, 1K outfit preview, and max instances 1. Production remains disabled/unconfigured.

## Environment

```env
AI_IMAGE_GENERATION_ENABLED=false
AI_MAX_IMAGES_PER_USER_PER_DAY=3
AI_QUOTA_EXEMPT_USER_IDS=
AI_QUOTA_TIMEZONE=Asia/Taipei
AI_IMAGE_OUTPUT_SIZE=1K
AI_ESTIMATED_COST_VTO_USD=0.06
AI_ESTIMATED_COST_OUTFIT_PREVIEW_USD=0.07
```

The VTO estimate follows Google Cloud's listed US$0.06 per generated image. The 1K Nano Banana estimate rounds the documented US$0.067 output charge upward and excludes the small input-token amount. Runtime writes the configured estimate to `estimated_cost_usd`; it is not a substitute for Cloud Billing evidence.

The 2026-10-01 Development smoke made exactly two provider requests: one VTO and one 1K outfit preview. Ledger estimate: US$0.13 total plus small image-input token cost. Cloud Billing credit balance had not yet posted a visible delta immediately after the run.

## Ledger accounting

`ootie_ai_generations` records:

- generation UUID and verified Auth user ID
- `styling`, `single_try_on`, or `outfit_preview`
- provider/model
- pending/processing/succeeded/failed/rejected status
- source item UUIDs
- private person/result storage paths
- estimated cost, error code and timestamps

Image quota counts claimed image generations for the local calendar day in `AI_QUOTA_TIMEZONE`. Failed provider calls remain counted because a provider may already have accepted and billed the request.

`AI_QUOTA_EXEMPT_USER_IDS` is an optional server-only comma-separated allowlist of verified Supabase Auth user UUIDs. It is intended only for explicitly approved Development presentation accounts. Exemption bypasses the per-user daily image count, but does not bypass authentication, ownership, points, idempotency, the project kill switch, provider quotas, or the generation ledger. Keep the value out of browser configuration and leave it empty in Production unless separately approved.

## Emergency response

1. Set `AI_IMAGE_GENERATION_ENABLED=false` on the Cloud Run revision.
2. Confirm `/v1/capabilities` returns `imageGenerationEnabled: false` and UI shows 「AI 圖像功能目前暫停」.
3. Review `ootie_ai_generations`, Cloud Logging and Cloud Billing by model/project.
4. Do not delete ledger rows to restore quota; use an explicitly reviewed administrative correction if necessary.
5. Resume only after root cause, current pricing, quota and project attribution are confirmed.

## Budget safeguards outside code

Before Live Smoke, configure a Cloud Billing budget and alerts for the selected project. A budget alert does not automatically stop spend, so keep the application kill switch and Vertex quotas as independent controls. Do not raise model quota or change 1K/one-image defaults without a cost review and explicit approval.
