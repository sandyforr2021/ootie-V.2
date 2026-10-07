# SUPABASE-BASELINE-BATCH-12｜003–012 batch execution plan

Status: local preparation only. No file in this plan has been executed. Target must be manually confirmed as `OOTIE-sandy-dev` immediately before a future run.

## Sole execution source

Only these files may be executed, in this order:

```text
supabase/personal_baseline/003_ootie_clothing_items.sql
supabase/personal_baseline/004_ootie_ootd_posts.sql
supabase/personal_baseline/005_ootie_sos_posts.sql
supabase/personal_baseline/006_ootie_outfit_suggestions.sql
supabase/personal_baseline/007_ootie_auxiliary.sql
supabase/personal_baseline/008_ootie_bookmarks.sql
supabase/personal_baseline/009_functions.sql
supabase/personal_baseline/010_triggers.sql
supabase/personal_baseline/011_rls_policies.sql
supabase/personal_baseline/012_storage.sql
```

`supabase/migrations/` and legacy SQL are excluded. 001 and 002 are already PASS and must not be rerun.

## Dependency graph

```text
001 extensions (already PASS)
└─ 002 ootie_profiles (already PASS)
   ├─ 003 clothing_items
   ├─ 004 ootd_posts
   ├─ 005 sos_posts
   │  └─ 006 outfit_suggestions
   ├─ 007 notifications / post_likes / saved_posts
   ├─ 008 bookmarks
   │  └─ 009 functions and grants
   │     └─ 010 triggers
   ├─ 011 RLS policies (all tables and profile bridge)
   └─ 012 Storage policies (profile bridge and bucket)
```

The requested numeric order is valid. 003–005 are independent table creates after 002; 006 depends on 005; 007 depends on 004; 009 depends on 003 and 008; 010 depends on 002, 008, and 009; 011 depends on all public OOTIE tables; 012 depends on the profile bridge and Storage platform objects.

## Per-file execution gates

| File | Purpose | Expected objects | Before execution | After execution | Stop condition |
| --- | --- | --- | --- | --- | --- |
| 003 | Create clothing table with explicit profile owner | 1 table, 21 columns, PK, profile FK, 1 PK index | Target, source hash, relation/row type/index absent, profile bridge | 21 columns; owner NOT NULL/no default; FK NO ACTION; zero rows; no RLS/policy/trigger | Any collision, owner mismatch, extra object, or transaction error |
| 004 | Create OOTD posts | 1 table, 10 columns, PK, author profile FK | `ootie_ootd_posts` relation/row type/index absent | Exact columns/PK/FK, zero rows | Any identity default, collision, or mismatch |
| 005 | Create SOS posts | 1 table, 15 columns, PK, status CHECK, requester and closet-owner profile FKs | `ootie_sos_posts` relation/row type/index absent | Exact columns, 3 FKs/check/PK, zero rows | Missing explicit profile identity, collision, or mismatch |
| 006 | Create outfit suggestions | 1 table, 7 columns, PK, SOS FK, author profile FK | `ootie_outfit_suggestions` relation/row type/index absent | Exact columns and 2 FKs, zero rows | Identity or dependency mismatch |
| 007 | Create notifications, likes, saved posts | 3 tables, PKs, 5 profile/post FKs | All three relation/row type/index names absent | Exact columns/constraints, zero rows | Any partial/extra object or mismatch |
| 008 | Create bookmarks and indexes | 1 table, 17 columns, PK, owner FK, 3 indexes | Table/row type/PK/index names absent | Exact columns, owner FK CASCADE as team evidence, 4 indexes, zero rows | Collision or index/FK mismatch |
| 009 | Create 3 evidenced RPCs, 2 trigger functions, grants | 5 functions and exported EXECUTE grants | Function signatures absent; 003/008 present | Function signatures/security/config/grants match; no RPC call | Missing dependency, duplicate function, or definition mismatch |
| 010 | Create Auth provisioning and bookmark triggers | 1 function, 3 triggers | Function/trigger names absent; 002/008/009 present | New-user-only provisioning; 2 bookmark triggers; no bulk insert | Collision, duplicate profile logic, or trigger mismatch |
| 011 | Enable RLS and create personal policies | 9 RLS states and profile-bridge owner policies | All OOTIE tables present; policy names absent | RLS enabled/not forced; matrix matches; no `auth.uid() = owner_id` | Any unsafe policy, missing mode, or unexpected policy |
| 012 | Create bucket and path-owned Storage policies | Bucket plus 4 policies | Bucket/policy names absent; profile bridge present | Bucket public; read public; writes bound to `bookmarks/<profile-id>/...` | Existing bucket/policy, path ownership mismatch, or error |

Every file is a separate process/transaction. A failure stops the batch; the helper never skips or edits a file and never continues to the next file automatically.

## Target and credential rules

- Before every run, visibly confirm Target = `OOTIE-sandy-dev`; never use the team project.
- The helper reads a connection string only from the current PowerShell process environment variable `OOTIE_PERSONAL_DATABASE_URL`; it does not write it to disk.
- Password entry is delegated to the local `psql` prompt. Do not place a password, service_role key, anon key, or secret in the environment variable, source files, or logs.
- The helper refuses to run unless the user passes `-TargetProjectName OOTIE-sandy-dev` and types the same name at the confirmation prompt.

## Failure handling and logging

The helper starts a new `psql` process for each file with `ON_ERROR_STOP=1`. It records only target name, file name, source hash, start/end time, exit code, and the local log path. It stops immediately on a non-zero exit code, hash mismatch, missing source file, missing manifest entry, missing `psql`, or uncertain target confirmation. It does not retry, rollback earlier committed files, or run a repair statement automatically.

After a failure, preserve the log and use the pre-migration backup plan for recovery. Run `FINAL_BASELINE_AFTER_CHECK.sql` only after all ten files report success and are manually reviewed.

## Final verification

Run `FINAL_BASELINE_AFTER_CHECK.sql` in the same manually verified personal project. Review every `MISSING`, `UNEXPECTED`, and `MISMATCH` row before enabling any application write flow.
