# YouCam safety release — 2026-10-23

## Deployed resources

- Existing URL: https://ootie-youcam-jury.onrender.com/
- Render service: `ootie-youcam-jury`, `srv-dbd300psrm7s73bf4s0g`, in the user-selected David's workspace.
- Source branch: `codex/youcam-commerce-checkpoint-20261022`.
- Live application commit: `086c0991f898e9ca6dadfc2710b748edff078eca`.
- Render deploy: `dep-dbditulg1s2s73bllong`, live at **2026-10-23 09:55:59 UTC**.
- Existing free web service, one instance, same URL, auto-deploy off. Updating the reviewer environment setting triggered this deploy; no second deploy was triggered.
- Supabase: `OOTIE-personal-dev`, `hoxkrmadzjnyjaqjbyxc`. The other Supabase projects were not modified.

## Migration and configuration

After reading the live schema, migration history, job states, and budget, applied `supabase/migrations/20261023091242_youcam_safety_and_recovery.sql` using Supabase's migration operation. Remote history records **20261023095421**, name **youcam_safety_and_recovery**. The filename timestamp and remote generated version therefore differ; do not rerun the migration based only on its filename.

SQL SHA-256: `b2b08584978252e969cce7cabb84e987602ba9f0bbff4394d308d889eaa50446`.

Verified defaults: 22 units per user per UTC day, at most three active jobs per user including all jobs in a submitted batch, and 22 units reserved for reviewers. Render's `YOUCAM_REVIEWER_USER_IDS` was merged into the existing environment using the established Maya / `jury_maya82` Auth identity. API keys were preserved without retrieving or printing them.

Before and after migration, the internal budget was 100 units with 46 allocated. Four successful jobs account for 26 units; one failed job with an existing provider task accounts for 20 units and remains allocated. No provider billing/refund was inferred from that failure. There were no in-flight jobs. After verification, the job count remained five and allocation remained 46. The reviewer's daily usage at deployment was zero, with 22 units available under the daily cap.

The provider screenshot's 1,014 remaining reward units is an earlier account observation, not the app's internal remaining budget and not a new provider balance query.

## Verification

- The full `npm test`, production build, and dependency audit passed before the initial push. The final batch-limit correction passed `node --test gateway/test/commerceSchema.test.js` and `git diff --check` before application.
- Post-migration checks confirmed the new table has RLS enabled; `anon` and `authenticated` lack direct access. The new enqueue, quota, reservation release, photo deletion, result deletion, and post deletion RPCs grant execution only to `service_role` among those roles.
- Supabase history contains the applied migration. Existing jobs were backfilled to consumed/submitted states without releasing an already-submitted task.
- Render reported the exact intended commit live. Startup logs showed the frontend entry, listening port 10000, and normal memory readings. No application error-level log entries were found in the observed post-start interval through 09:59 UTC.
- `GET /`, `/shop`, `/settings`, and `/legal/privacy` returned 200 and the exact live commit in `X-OOTIE-Revision`.
- `/healthz` returned 200 with `ok: true` and YouCam configured. The main JavaScript asset returned 200.
- `/api/v1/shop/posts` returned the existing public post; anonymous `/api/v1/shop/jobs` returned 401.
- Chromium at 393×852 loaded the homepage, shopping studio, and English privacy page without uncaught page errors.
- No live generation, account-password change, new account, or deletion of user media was needed for these checks.

## Remaining acceptance boundaries

Authenticated end-to-end deletion, share withdrawal, and real generation recovery were not repeated against live user records during this deployment; local tests and database permission checks cover these changes. This environment has no saved jury password. Sleep/restart recovery with a real in-flight provider task and mobile physical-device performance remain separate acceptance work. The free Render service can still sleep when idle.

The post-migration Supabase advisor findings match the pre-existing warnings. Its additional RLS-without-policy information for the new deletion-lease table is expected for a service-only table with direct member/anonymous privileges revoked. Existing public count and authenticated demo RPC warnings were not changed. References: [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [anonymous definer RPCs](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated definer RPCs](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
