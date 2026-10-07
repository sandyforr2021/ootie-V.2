# Production deployment templates — not authorized for execution

These value-free templates document the future service boundary. They are not a deployment script and intentionally cannot name a Supabase project, custom domain, OAuth client, secret version or image digest.

Release procedure after every blocker is closed and the user gives explicit final approval:

1. Copy each template to a local ignored file.
2. Replace every `REQUIRED_*` sentinel from the approved release record/Secret Manager.
3. Run `npm run check:production-readiness`.
4. Build immutable web/Gateway images and record digests.
5. Deploy with separate Production service identities.
6. Run health/auth/storage/core-journey smoke with disposable Production test accounts.
7. Keep Production AI disabled until the separately approved one-request smoke.

Never copy `deploy/preview` environment files into this directory.

