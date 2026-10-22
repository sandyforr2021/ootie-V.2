# Free jury deployment

The reviewed configuration is `render.yaml`: one **Free Node Web Service**, no new database, disk, paid worker, payment provider, or automatic deploy. It serves the compiled Vue app and `/api` gateway from one HTTPS origin. All persistent photos, queues and user records stay in OOTIE Supabase (`hoxkrmadzjnyjaqjbyxc`).

## Configure

- Repository: sandyforr2021/ootie-V.2, branch `codex/youcam-commerce-checkpoint-20261022`.
- Build: `npm ci --include=dev && npm ci --prefix gateway --omit=dev && node scripts/build-free-deploy.mjs`
- Start: `node gateway/src/server.js`
- Plan: **Free**, workspace without a payment method. Do not select Starter or a paid workspace upgrade.
- Health path: `/healthz`. Node 22.22.0. `SERVE_WEB_APP=true`.
- Server environment: copy the exact public/project settings from `render.yaml`; enter the existing Supabase publishable key, OOTIE server secret and YouCam API key only in Render's protected environment settings. Never commit or put server secrets in `VITE_` variables.
- `RENDER_EXTERNAL_URL` is supplied by Render and added to the gateway's exact origin allowlist. The frontend uses `/api`.
- Add the resulting HTTPS URL to OOTIE Supabase Auth site/redirect allowlist if OAuth or confirmation links are enabled. Never change the drumstand project.
- Configure the browser companion with the deployed HTTPS origin; the ZIP is available under `/downloads/ootie-browser-companion.zip`.

## Limits and verification

Render Free sleeps after 15 minutes without incoming traffic and may need about one minute to resume. The durable queue survives a restart; processing resumes when the service wakes. Do not promise uninterrupted background execution while asleep. No synthetic keep-alive requests are configured.

No payment method is the zero-charge safeguard: bandwidth exhaustion suspends free services and build exhaustion stops new builds. Without this safeguard, a Free compute instance can still have billed bandwidth/build overages. Check dashboard billing before creating the service.

After deployment verify: HTTPS entry + wardrobe animation, jury login, stored wardrobe, product source links, saved YouCam image and colors, refresh persistence, anonymous rejection of private images, then one controlled live job if needed. The existing local acceptance results avoid unnecessary repeat generation.

References: https://render.com/docs/free and https://render.com/docs/blueprint-spec (checked 2026-10-22).
