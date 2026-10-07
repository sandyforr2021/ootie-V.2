# Clothing ownership contract

Status: canonical contract for the OOTIE personal baseline. This document records the required frontend/database boundary; this phase does not implement or execute a write flow.

## Canonical identity chain

```text
auth.users.id
  -> public.ootie_profiles.user_id
  -> public.ootie_profiles.id
  -> public.ootie_clothing_items.owner_id
```

`ootie_clothing_items.owner_id` is a profile identifier. It is not an Auth user identifier.

## Create-clothing flow

1. Read the authenticated session and require `session.user.id`.
2. Query `public.ootie_profiles` for the one row whose `user_id` equals `session.user.id`.
3. If no current profile exists, stop and return the domain error `PROFILE_MISSING`. Do not attempt the clothing insert.
4. Use the returned `ootie_profiles.id` as the exact `owner_id` value.
5. Insert the clothing row with `owner_id` explicitly present in the payload.
6. If profile lookup or insertion fails for another reason, return the real failure. Do not replace it with local/mock success.

## Required database contract

- `owner_id uuid NOT NULL`
- no `owner_id` default
- FK: `owner_id -> public.ootie_profiles(id)`
- delete action: `NO ACTION`
- no direct FK from the clothing table to `auth.users(id)`

The item `id` may continue to use `gen_random_uuid()`. This generator is only for the clothing record's own primary key and must never supply `owner_id`.

## Prohibited ownership behavior

- Omitting `owner_id` from an insert.
- Generating a random UUID for `owner_id`.
- Passing `session.user.id` directly as `owner_id`.
- Using `user-01`, `profile-01`, or any fixed mock identity.
- Falling back to a mock owner or mock insert after any Supabase failure.
- Creating a profile implicitly inside the clothing insert path without a separately reviewed profile-provisioning contract.

## Expected error boundary

| Situation | Required result |
| --- | --- |
| No authenticated session | authentication-required failure; no query that writes clothing |
| Auth session exists but matching profile does not | `PROFILE_MISSING`; no clothing insert |
| Profile lookup fails | propagate an explicit lookup failure; no mock fallback |
| Insert fails | propagate an explicit insert failure; no mock fallback |
| Profile exists and insert succeeds | return the created clothing result tied to that profile ID |

## Implementation status

The 003 database migration now enforces the required owner presence and FK. The current frontend does not yet implement this contract: `src/services/supabase.js` still contains the legacy `items.user_id` insertion path, and `src/stores/closet.js` still creates a local clothing row with `owner_id: 'profile-01'`. Frontend write-code changes are outside this migration-only phase and must be completed and reviewed before a clothing write test is enabled.
