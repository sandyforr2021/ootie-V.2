# OOTIE Personal Supabase Execution Manifest

Status: **001–019 applied to the isolated Development project `OOTIE-personal-dev`** on 2026-10-01. The legacy `OOTIE-sandy-dev` project was inspected only and was not modified.

## Target

- Project name: `OOTIE-personal-dev`
- Project ref: `hoxkrmadzjnyjaqjbyxc`
- Region: Singapore (`ap-southeast-1`)
- Organization plan: Free
- Scope: OOTIE Auth, Database, Storage, Functions and policies only
- Excluded: n8n/workflow/credentials tables, legacy migrations, seed data, and every object in `OOTIE-sandy-dev`

## Canonical order

The only rebuild source is `supabase/personal_baseline/001_*.sql` through `019_*.sql`, executed in numeric order. Each file contains its own transaction. Do not mix in `supabase/migrations/`, `supabase/bookmarks-storage.sql`, legacy SQL, or the archived `OOTIE_SUPABASE_BATCH_003_012_SAFE` copies.

```text
001 extensions
 -> 002 profiles
 -> 003 clothing
 -> 004 OOTD
 -> 005 SOS
 -> 006 outfit suggestions
 -> 007 notifications/likes/saved posts
 -> 008 bookmarks
 -> 009 functions
 -> 010 triggers
 -> 011 table grants and RLS
 -> 012 bookmarks Storage
 -> 013 private profile, points and avatar Storage
 -> 014 saved outfits
 -> 015 OOTD media
 -> 016 AI ledger, private AI Storage and quota/idempotency claim
 -> 017 least-privilege Cloud Run Gateway Data API grants
 -> 018 remove broad public-bucket listing policies
 -> 019 restore authenticated owner-only SELECT needed by Storage replace/delete
 -> 020 Development Demo subscription, points, birthday and AI debit
 -> 021 Development seed runner access for saved outfits
```

## Current source hashes

| File | SHA-256 |
| --- | --- |
| `001_extensions.sql` | `CEFAE98324FF9DC6F546239D953CB4E9BEEEF5E9472630A04F872741700492A7` |
| `002_ootie_profiles.sql` | `C849472DF5C3E924309540267385F215F4E52638FF7B20E7184B58A83696BB36` |
| `003_ootie_clothing_items.sql` | `0BF2541669345C391D6EAC17A65A9B1775274E93D0FE1B2717BB1A100C26984E` |
| `004_ootie_ootd_posts.sql` | `94CD0851EF68E2CF2A563EBCE580887603B4D835D4B9218AF7FA94333AE4118D` |
| `005_ootie_sos_posts.sql` | `FFAF30082EE310FD2B57BF18809ED9A97A53838352B35605CD7317044239103D` |
| `006_ootie_outfit_suggestions.sql` | `3A94A6CC696AAF3CE0DD41AB03E668941C70DC53612D59D525CE227A1457AFF8` |
| `007_ootie_auxiliary.sql` | `FB44C90E8A9604A2DF29C4BE59EB0817A7A6CBB65CACACA4719AB0DCE5059D51` |
| `008_ootie_bookmarks.sql` | `99AD46B2E103155AF3737E21D84C6E2CD8FAC7B38085CE5D59DDAD368FFCF07E` |
| `009_functions.sql` | `3B10D6DFB0C2352E496F6F0DE225E4659FFC81AFD55A16044573B224EDD4A7E0` |
| `010_triggers.sql` | `36C0CBCD525BD613E03871FA5FCA63F2FDCDE1FA59186BC38FFE470F69D4671C` |
| `011_rls_policies.sql` | `0D6A25ED3285E460047ADD2F10EE7944E3393228C0A7C382710FA2F4D4A3450F` |
| `012_storage.sql` | `711D2971BBB47C5B4FBAF461D430175ABBB96028B024799192941127E86C695D` |
| `013_profile_account_foundation.sql` | `D9B40A2E86A2911DD30AE82FEBB293B0A351DA12D1A0175ADA4FE36DC6ABE9AE` |
| `014_saved_outfits_metrics.sql` | `DFBA1DAC2BBAAD668C6183AB489C78BDEE80F7FF3A285F5C928BE02BED5A46B7` |
| `015_ootd_publish_foundation.sql` | `81EC2E7A1909095D4A3CE5F5A09362804167B97AA8EAE2E0D4352BDC1987F81D` |
| `016_ootie_ai_gateway.sql` | `B5D8D48F48FACEF7FF1D40B694FF0B078B6B13121AF52854BFCA06BEBD77EF02` |
| `017_ootie_ai_gateway_runtime_grants.sql` | `8941279B0E73B497BB7A105470252C025308746D1EB6132DDF2702FF98BF6EC7` |
| `018_remove_public_bucket_listing_policies.sql` | `EEEB26A16B3FE7842539F206CFF412EADFAA9A58B2D92A66A15C280EC0C56523` |
| `019_public_bucket_owner_select.sql` | `94B13171A5203030679C84550C37C15EF9DF618DF89237A695CD5048F76B0378` |
| `020_demo_subscription_points.sql` | `770CAD5A57A9119E2734F6C4290F88378F3FF9E833A524F03839BBC0D3D1A30A` |
| `021_demo_seed_saved_outfits_grant.sql` | `6F49EBF5E339E27E24C4F2B625660C4DD8E4AC1A4F6789317FCC27432CF1F2F4` |
| `022_social_remote_product_import_weather.sql` | `526DF15417FACB33AE36ACB136141B3F769185AC68E93321704D997FA0C1ED5C` |
| `023_social_service_role_grant.sql` | `AAB8A3C64C4F4839F3495604689D36CDCDFBDBE2B7E772D222D037FB4CFB7566` |
| `024_restrict_rls_auto_enable.sql` | `CA7716032E590F09CC0B367E5E109EDD18017D062907AA84AAA15CD622168E6F` |
| `025_index_phase3_foreign_keys.sql` | `88B56CB15D4FF19AC159C543B4B2099744C95DDA838FAEAF3D59F0EF43CDCA2B` |
| `026_clothing_media_lifecycle.sql` | `15753860870E5DDD6931853B496B68048B2D786B97E20EB7EF410CE8119E6252` |
| `027_production_readiness_acl_hardening.sql` | `1A374B0054AB230D8915B6069EF2F1B1CDDDE13454FB34B802784DB417F851EE` |

## Execution record

| Migration | Target | Execution | Postcheck |
| --- | --- | --- | --- |
| 001–016 | `hoxkrmadzjnyjaqjbyxc` | PASS, numeric order, one transaction per migration | PASS |
| 017 | `hoxkrmadzjnyjaqjbyxc` | PASS after remote member smoke exposed missing service-role table privileges | PASS: profile/clothing reads and ledger updates work through Gateway |
| 018 | `hoxkrmadzjnyjaqjbyxc` | PASS; removed three broad public read/list policies | PASS: anonymous and cross-member listings expose no objects |
| 019 | `hoxkrmadzjnyjaqjbyxc` | PASS; added owner-only authenticated SELECT policies | PASS: owner replace/delete restored; cross-member replace/delete remain denied/no-op |
| 020 | `hoxkrmadzjnyjaqjbyxc` | PASS; added Development Demo subscription/points and points-aware AI claim/debit | PASS: login, balance 245, PLUS plan, subscription/credit idempotency and birthday repeat denial |
| 021 | `hoxkrmadzjnyjaqjbyxc` | PASS; added Development seed-runner grant for saved outfits | PASS: eight canonical saved outfits seeded; Profile metric reads 8 |
| 022 | `hoxkrmadzjnyjaqjbyxc` | PASS; remote follows, notification triggers, source attribution and weather city | PASS: remote social/auth/ownership/weather smoke |
| 023 | `hoxkrmadzjnyjaqjbyxc` | PASS; narrow service-role follow-table grant | PASS: smoke cleanup and repeatability |
| 024 | `hoxkrmadzjnyjaqjbyxc` | PASS; revoked RLS helper from browser roles | PASS: anon=false, authenticated=false, service_role=true |
| 025 | `hoxkrmadzjnyjaqjbyxc` | PASS; indexed two nullable foreign keys | PASS: Performance Advisor has no unindexed-FK suggestions |

The SQL Editor run used compact statements derived from the canonical files because the dashboard editor could not reliably accept the original multi-file paste. Remote catalog checks verified the resulting 13 public OOTIE tables, constraints, indexes, functions, triggers, grants, buckets and policies. The hash table above locks the reproducible canonical rebuild source; it is not a claim that Supabase CLI migration history exists.

## Post-apply verification

- Public OOTIE tables: 13
- RLS enabled: 13/13
- RLS disabled: 0
- Storage buckets: 4 (`ootie-bookmarks-images`, `ootie-profile-avatars`, `ootie-ootd-images`, `ootie-ai-private`)
- AI bucket: private; browser write policies absent
- AI ledger: browser SELECT-own only; INSERT/UPDATE/DELETE remain server-only
- Public bucket smoke: public object URLs work; anonymous/cross-member listings return no rows; cross-member replace fails and delete is a no-op; owner replace/delete work
- Performance Advisor: 0 errors, 0 warnings, 9 informational unused-index suggestions
- Security Advisor: 0 errors, 5 warnings: four intentional authenticated subscription/points RPC notices and Auth leaked-password protection disabled

The remote schema and canonical 001–025 chain are aligned for OOTIE-owned objects. The remaining Security warnings are not RLS/Storage regressions; leaked-password protection is unavailable on the current Free plan and the four RPCs intentionally expose verified-user operations.

## Rules for future rebuilds

1. Confirm the target project ref before every migration.
2. Apply only 001–025 in numeric order to an empty Development Supabase project; review the Development-only service-role seed grants before any Production migration plan.
3. Stop on a hash mismatch, unexpected collision or SQL error.
4. Never put a password, service-role key or access token in this manifest or any committed file.
5. Re-run all static validators plus Supabase Security and Performance Advisors after apply.
6. Do not modify the contaminated `OOTIE-sandy-dev` project as part of this chain.
# Development addendum — Migration 026

- Target: `OOTIE-personal-dev` (`hoxkrmadzjnyjaqjbyxc`)
- Migration: `026_clothing_media_lifecycle.sql`
- Applied: 2026-10-02 through the authenticated Supabase migration API
- Result: PASS
- Postcheck: `ootie-closet-media` is private, 20 MB, JPEG/PNG/WebP, with four owner-path policies; eight `photo_*` columns present.
- Remote smoke: owner read/write, anon and cross-user denial, referenced-delete guard, replace ordering, unreferenced delete cleanup and logout denial all PASS.
- Production: not targeted and unchanged.

# Phase 9 addendum — Migration 027 and Production rehearsal

- Target: `OOTIE-personal-dev` (`hoxkrmadzjnyjaqjbyxc`)
- Migration: `027_production_readiness_acl_hardening.sql`
- Applied: 2026-10-02 through the authenticated Supabase migration API
- Result: PASS
- Postcheck: `anon`, `authenticated` and `service_role` all have `EXECUTE=false` for the two trigger-only SECURITY DEFINER functions.
- Advisors after apply: four Development demo/points RPC warnings, leaked-password protection disabled, and four informational unused indexes; no new RLS/Storage regression.
- Clean local rehearsal: 001–027 applied from zero with no seed, 15 public tables, 0 rows, 0 RLS-disabled public tables, 62 public/storage policies, 5 buckets, and `supabase db lint` with no schema errors.
- Remote migration-history note: the Supabase migration API records 026 and 027. Migrations 001–025 predate formal remote history and were catalog-verified during their batches; this is not equivalent to a Production CI migration trail.
- Production promotion: use `production/production-migration-manifest.json`; do not apply the Development chain unchanged because 020/021/023 contain demo/seed behavior.
- Production: not created, not targeted and unchanged.
