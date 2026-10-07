# OOTIE Production Migration Rehearsal

Date: 2026-10-02  
Target: isolated local Supabase stack only  
Production launch/resource creation: none

## Procedure

1. Started Docker Desktop locally.
2. Created an isolated temporary Supabase workspace outside the repository.
3. Copied migrations 001–026 into canonical numeric order.
4. Ran `supabase db reset --local --no-seed` from an empty database.
5. Ran `supabase db lint --local --level warning`.
6. Inspected table/RLS/policy/bucket/function ACL counts.
7. Created migration 027 through Supabase CLI, added its canonical source to the repository, and replayed 001–027 from zero.

## Result

- 27 migrations applied from zero: PASS.
- Public tables: 15.
- Public rows after reset: 0 (no presentation seed was applied).
- Public tables without RLS: 0.
- Policies across `public` and `storage`: 62.
- Storage buckets: 5.
- Local schema lint after 027: no schema errors.
- Trigger-only SECURITY DEFINER functions executable by browser/service roles after 027: 0.

Migration 027 was also applied to `OOTIE-personal-dev` and verified that `anon`, `authenticated` and `service_role` cannot execute `validate_ootie_saved_outfit_target()` or `guard_ootie_ootd_item_ownership()` directly. Development product triggers continue to execute through the database owner context.

## Drift found

1. The repository is reproducible, but remote Supabase migration history records only migrations 026 and 027 because 001–025 were originally applied through dashboard/API workflows. The remote catalog was verified in prior phases, but migration-history equivalence is not present.
2. Migrations 020, 021 and 023 are explicitly Development/demo-specific and must not be promoted unchanged.
3. Migration 025 depends on a column introduced by 020, so it must follow the Production replacement for the entitlement/points contract.
4. Early migration headers still reference an old Development target/local-draft state. SQL execution succeeded, but release automation must not use comments as environment authority.
5. Development advisors retain four authenticated demo/points SECURITY DEFINER RPC warnings and leaked-password protection disabled. These are Development classifications, not accepted Production findings.

## Required second rehearsal

After the Production promotion chain replaces/excludes Development migrations:

1. create a new empty local database;
2. apply only the final Production manifest in order;
3. assert zero seed users/content and zero Development URL/ID/reference;
4. run schema lint and Security/Performance Advisors on an isolated remote rehearsal target;
5. verify RLS, function grants, buckets/policies, auth bootstrap, AI ledger, notifications and clothing media lifecycle;
6. archive hashes and the final migration list in the release record.

Until this second rehearsal passes, migration readiness is **BLOCKED** for Production even though the full Development chain successfully rebuilds.

